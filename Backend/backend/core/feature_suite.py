from __future__ import annotations

import base64
import csv
import io
import json
import secrets
import calendar
import hashlib
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .state import AppState
from .vault import _derive_argon2id
from .address_book import AddressBookService


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso() -> str:
    return now().isoformat()


def amount(value: Any, *, positive: bool = True) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("Amount must be a valid decimal number") from exc
    if not result.is_finite() or (positive and result <= 0) or (not positive and result < 0):
        raise ValueError("Amount must be positive" if positive else "Amount cannot be negative")
    if result.as_tuple().exponent < -18:
        raise ValueError("Amount precision exceeds 18 decimal places")
    return result


def _event(state: AppState, action: str, *, subject: str | None = None, details: dict | None = None) -> None:
    # Audit records deliberately exclude addresses, amounts, credentials and keys.
    rows = state.vault.data().setdefault("security_events", [])
    rows.append({"id": secrets.token_hex(10), "action": action, "subject": subject,
                 "details": details or {}, "created_at": iso()})
    del rows[:-1000]
    # Persist the audit event itself. Most callers have already saved the
    # underlying mutation; without this second save the audit trail was lost.
    state.vault.save()


class FeatureSuite:
    """Vault-backed management features. No method signs or broadcasts a transaction."""

    SYNC_KEYS = ("address_book", "wallet_groups", "transaction_policy", "payment_requests",
                 "cost_basis_lots", "cost_basis_events", "wallet_labels", "settings_metadata")

    def __init__(self, state: AppState) -> None:
        self.state = state
        self.data = state.vault.data()

    # ---- Wallet groups and labels -------------------------------------------------
    def groups(self) -> list[dict[str, Any]]:
        wallets = {w.get("id") for w in self.data.get("wallets", [])}
        result = []
        for group in self.data.setdefault("wallet_groups", []):
            members = [x for x in group.get("wallet_ids", []) if x in wallets]
            result.append({**group, "wallet_ids": members, "wallet_count": len(members)})
        return result

    def create_group(self, name: str, description: str = "", color: str = "slate") -> dict[str, Any]:
        name = name.strip()
        if not name or len(name) > 60 or len(description) > 240:
            raise ValueError("Group name must be 1–60 characters; description up to 240")
        rows = self.data.setdefault("wallet_groups", [])
        if any(x["name"].casefold() == name.casefold() for x in rows):
            raise ValueError("A wallet group with this name already exists")
        item = {"id": secrets.token_hex(10), "name": name, "description": description.strip(),
                "color": color if color in {"slate", "blue", "green", "amber", "violet", "rose"} else "slate",
                "wallet_ids": [], "created_at": iso(), "updated_at": iso()}
        rows.append(item); self.state.vault.save(); _event(self.state, "wallet_group.created", subject=item["id"])
        return {**item, "wallet_count": 0}

    def set_group_members(self, group_id: str, wallet_ids: list[str]) -> dict[str, Any]:
        group = next((x for x in self.data.setdefault("wallet_groups", []) if x.get("id") == group_id), None)
        if not group: raise KeyError("Wallet group not found")
        known = {w.get("id") for w in self.data.get("wallets", [])}
        if len(wallet_ids) != len(set(wallet_ids)) or any(x not in known for x in wallet_ids):
            raise ValueError("Every wallet must exist and may only appear once")
        group["wallet_ids"] = list(wallet_ids); group["updated_at"] = iso()
        self.state.vault.save(); _event(self.state, "wallet_group.members_updated", subject=group_id, details={"count": len(wallet_ids)})
        return {**group, "wallet_count": len(wallet_ids)}

    def delete_group(self, group_id: str) -> None:
        rows = self.data.setdefault("wallet_groups", [])
        before = len(rows); rows[:] = [x for x in rows if x.get("id") != group_id]
        if before == len(rows): raise KeyError("Wallet group not found")
        self.state.vault.save(); _event(self.state, "wallet_group.deleted", subject=group_id)

    # ---- Spending policies and recipient risk ------------------------------------
    def get_policy(self) -> dict[str, Any]:
        policy = self.data.setdefault("transaction_policy", {})
        defaults = {"require_new_recipient_confirmation": True, "require_trusted_recipient": False,
                    "recipient_cooldown_minutes": 0, "per_transaction_limit": None,
                    "daily_spend_limit": None, "max_fee_ratio_percent": 10.0,
                    "require_second_confirmation_above": None, "updated_at": None}
        return {**defaults, **policy}

    def set_policy(self, updates: dict[str, Any]) -> dict[str, Any]:
        allowed = {"require_new_recipient_confirmation", "require_trusted_recipient", "recipient_cooldown_minutes",
                   "per_transaction_limit", "daily_spend_limit", "max_fee_ratio_percent", "require_second_confirmation_above"}
        if set(updates) - allowed: raise ValueError("Unsupported policy field")
        policy = self.get_policy()
        policy.update(updates)
        for key in ("per_transaction_limit", "daily_spend_limit", "require_second_confirmation_above"):
            if policy.get(key) is not None:
                v = amount(policy[key]); policy[key] = str(v)
        cooldown = int(policy.get("recipient_cooldown_minutes") or 0)
        if cooldown < 0 or cooldown > 10080: raise ValueError("Recipient cooldown must be 0–10080 minutes")
        ratio = float(policy.get("max_fee_ratio_percent") or 0)
        if not 0 <= ratio <= 100: raise ValueError("Maximum fee ratio must be 0–100 percent")
        policy["recipient_cooldown_minutes"] = cooldown
        policy["max_fee_ratio_percent"] = ratio
        policy["updated_at"] = iso()
        self.data["transaction_policy"] = policy
        self.state.vault.save(); _event(self.state, "transaction_policy.updated")
        return policy

    def evaluate_transfer(self, *, network: str, destination: str, value: Any, wallet_id: str | None = None,
                          fee: Any = 0) -> dict[str, Any]:
        n = AddressBookService.normalize_network(network)
        recipient = AddressBookService(self.state).recipient_status(destination, n)
        policy = self.get_policy()
        qty, fee_value = amount(value), amount(fee, positive=False)
        warnings: list[str] = []; blockers: list[str] = []
        recipient["requires_confirmation"] = bool(policy["require_new_recipient_confirmation"] and (not recipient["known"] or not recipient["trusted"]))
        if recipient["requires_confirmation"]:
            warnings.append("NEW_OR_UNTRUSTED_RECIPIENT")
        if policy["require_trusted_recipient"] and not recipient["trusted"]:
            blockers.append("RECIPIENT_NOT_TRUSTED")
        contact = next((x for x in self.data.setdefault("address_book", []) if x.get("id") == recipient.get("contact_id")), None)
        cooldown = int(policy["recipient_cooldown_minutes"])
        if contact and not recipient["trusted"] and cooldown:
            try:
                created = datetime.fromisoformat(contact["created_at"])
                if created.tzinfo is None: created = created.replace(tzinfo=timezone.utc)
                if now() - created < timedelta(minutes=cooldown):
                    blockers.append("RECIPIENT_COOLDOWN_ACTIVE")
            except (KeyError, ValueError):
                warnings.append("RECIPIENT_AGE_UNKNOWN")
        if policy.get("per_transaction_limit") is not None and qty > Decimal(str(policy["per_transaction_limit"])):
            blockers.append("PER_TRANSACTION_LIMIT_EXCEEDED")
        if policy.get("daily_spend_limit") is not None:
            today = now().date().isoformat(); spent = Decimal("0")
            for row in self.data.get("execution_records", []):
                stamp = str(row.get("created_at", ""))[:10]
                if stamp == today and row.get("state") in {"BROADCASTED", "CONFIRMED", "SIGNED"}:
                    if wallet_id is None or row.get("wallet_id") == wallet_id:
                        try: spent += amount(row.get("amount", 0), positive=False)
                        except ValueError: pass
            if spent + qty > Decimal(str(policy["daily_spend_limit"])):
                blockers.append("DAILY_SPEND_LIMIT_EXCEEDED")
        if fee_value > 0 and float(fee_value / qty * 100) > float(policy["max_fee_ratio_percent"]):
            warnings.append("FEE_RATIO_HIGH")
        if policy.get("require_second_confirmation_above") is not None and qty >= Decimal(str(policy["require_second_confirmation_above"])):
            warnings.append("HIGH_VALUE_SECOND_CONFIRMATION")
        risk = "BLOCK" if blockers else "REVIEW" if warnings else "LOW"
        score = 0
        factors = []
        if recipient["requires_confirmation"]:
            score += 35; factors.append("NEW_OR_UNTRUSTED_RECIPIENT")
        if "FEE_RATIO_HIGH" in warnings:
            score += 20; factors.append("FEE_RATIO_HIGH")
        if "HIGH_VALUE_SECOND_CONFIRMATION" in warnings:
            score += 20; factors.append("HIGH_VALUE_TRANSFER")
        if "RECIPIENT_COOLDOWN_ACTIVE" in blockers:
            score += 50; factors.append("RECIPIENT_COOLDOWN_ACTIVE")
        if "RECIPIENT_NOT_TRUSTED" in blockers:
            score += 50; factors.append("RECIPIENT_NOT_TRUSTED")
        if any(x in blockers for x in ("PER_TRANSACTION_LIMIT_EXCEEDED", "DAILY_SPEND_LIMIT_EXCEEDED")):
            score += 70; factors.extend(x for x in blockers if x.endswith("LIMIT_EXCEEDED"))
        if blockers:
            score = 100
        score = min(100, score)
        return {"allowed": not blockers, "risk_level": risk, "risk_score": score,
                "risk_band": "HIGH" if score >= 70 else "MEDIUM" if score >= 30 else "LOW",
                "risk_factors": list(dict.fromkeys(factors)), "recipient": recipient,
                "warnings": warnings, "blockers": blockers, "policy": policy,
                "review_required": bool(warnings), "read_only": True,
                "risk_score_note": "Heuristic review aid only; not a fraud verdict or guarantee of destination safety."}

    # ---- Scheduled / recurring payment intents -----------------------------------
    def schedules(self) -> list[dict[str, Any]]:
        return list(reversed(self.data.setdefault("scheduled_transfers", [])))

    def create_schedule(self, item: dict[str, Any]) -> dict[str, Any]:
        qty = amount(item["amount"])
        if not any(w.get("id") == item["wallet_id"] for w in self.data.get("wallets", [])):
            raise ValueError("Source wallet does not exist")
        run_at = datetime.fromisoformat(item["run_at"].replace("Z", "+00:00"))
        if run_at.tzinfo is None: raise ValueError("run_at must include a timezone")
        if run_at < now() - timedelta(minutes=1): raise ValueError("Scheduled time must be in the future")
        recurrence = item.get("recurrence", "none")
        if recurrence not in {"none", "daily", "weekly", "monthly"}: raise ValueError("Unsupported recurrence")
        # Scheduling only creates a review item. It never signs or broadcasts.
        schedule_id = secrets.token_hex(10)
        record = {"id": schedule_id, "series_id": schedule_id, "wallet_id": item["wallet_id"], "network": item["network"],
                  "destination": item["destination"], "amount": str(qty), "asset": item.get("asset", "native"),
                  "run_at": run_at.astimezone(timezone.utc).isoformat(), "recurrence": recurrence,
                  "memo": str(item.get("memo", ""))[:240], "status": "SCHEDULED", "created_at": iso(),
                  "approval_required": True, "broadcasted": False}
        self.data.setdefault("scheduled_transfers", []).append(record)
        self.state.vault.save(); _event(self.state, "transfer.scheduled", subject=record["id"])
        return record

    def process_due(self) -> dict[str, Any]:
        changed = 0; current = now()
        for row in self.data.setdefault("scheduled_transfers", []):
            if row.get("status") != "SCHEDULED": continue
            try: run_at = datetime.fromisoformat(row["run_at"])
            except (ValueError, KeyError): continue
            if run_at <= current:
                row["status"] = "AWAITING_MANUAL_APPROVAL"; row["due_at"] = iso(); changed += 1
                recurrence = row.get("recurrence", "none")
                if recurrence in {"daily", "weekly", "monthly"}:
                    if recurrence == "daily": next_at = run_at + timedelta(days=1)
                    elif recurrence == "weekly": next_at = run_at + timedelta(weeks=1)
                    else:
                        month_index = run_at.month - 1 + 1
                        year = run_at.year + month_index // 12
                        month = month_index % 12 + 1
                        day = min(run_at.day, calendar.monthrange(year, month)[1])
                        next_at = run_at.replace(year=year, month=month, day=day)
                    self.data.setdefault("scheduled_transfers", []).append({**{k: v for k, v in row.items() if k not in {"id", "status", "created_at", "due_at", "updated_at"}},
                        "id": secrets.token_hex(10), "series_id": row.get("series_id", row["id"]),
                        "run_at": next_at.isoformat(), "status": "SCHEDULED", "created_at": iso(),
                        "approval_required": True, "broadcasted": False})
        if changed:
            self.state.vault.save(); _event(self.state, "transfer.schedules_due", details={"count": changed})
        return {"processed": changed, "broadcasted": 0, "requires_manual_approval": changed}

    def approve_schedule(self, schedule_id: str) -> dict[str, Any]:
        row = next((x for x in self.data.setdefault("scheduled_transfers", []) if x.get("id") == schedule_id), None)
        if not row: raise KeyError("Scheduled transfer not found")
        if row.get("status") != "AWAITING_MANUAL_APPROVAL": raise ValueError("Only due schedules awaiting approval can be approved")
        row["status"] = "READY_FOR_MANUAL_EXECUTION"; row["approved_at"] = iso(); row["broadcasted"] = False
        self.state.vault.save(); _event(self.state, "transfer.schedule_approved_for_manual_execution", subject=schedule_id)
        return row

    def cancel_schedule(self, schedule_id: str) -> dict[str, Any]:
        row = next((x for x in self.data.setdefault("scheduled_transfers", []) if x.get("id") == schedule_id), None)
        if not row: raise KeyError("Scheduled transfer not found")
        if row.get("status") not in {"SCHEDULED", "AWAITING_MANUAL_APPROVAL"}: raise ValueError("This schedule cannot be cancelled")
        row["status"] = "CANCELLED"; row["updated_at"] = iso()
        self.state.vault.save(); _event(self.state, "transfer.schedule_cancelled", subject=schedule_id)
        return row

    # ---- Draft batches; these are deliberately not a broadcasting endpoint --------
    def batches(self) -> list[dict[str, Any]]:
        return list(reversed(self.data.setdefault("batch_transfers", [])))

    def create_batch(self, wallet_id: str, network: str, transfers: list[dict[str, Any]]) -> dict[str, Any]:
        if not 1 <= len(transfers) <= 100: raise ValueError("A batch must contain 1–100 transfers")
        known_wallet = any(w.get("id") == wallet_id for w in self.data.get("wallets", []))
        if not known_wallet: raise ValueError("Source wallet does not exist")
        normalized = []; total = Decimal("0")
        for t in transfers:
            address = AddressBookService.validate_address(AddressBookService.normalize_network(network), t["destination"])
            qty = amount(t["amount"]); total += qty
            normalized.append({"destination": address, "amount": str(qty), "asset": str(t.get("asset", "native"))})
        record = {"id": secrets.token_hex(10), "wallet_id": wallet_id, "network": network,
                  "transfers": normalized, "total_amount": str(total), "count": len(normalized),
                  "status": "DRAFT_REQUIRES_INDIVIDUAL_SIMULATION", "created_at": iso(),
                  "broadcasted": False, "signing_available": False}
        self.data.setdefault("batch_transfers", []).append(record)
        self.state.vault.save(); _event(self.state, "batch.created", subject=record["id"], details={"count": len(normalized)})
        return record

    # ---- FIFO cost basis and tax export --------------------------------------------
    def ledger_entries(self) -> list[dict[str, Any]]:
        return list(reversed(self.data.setdefault("cost_basis_events", [])))

    def add_ledger_entry(self, entry: dict[str, Any]) -> dict[str, Any]:
        kind = entry["kind"]
        if kind not in {"acquisition", "disposal", "fee", "transfer_in", "transfer_out", "adjustment"}:
            raise ValueError("Unsupported cost-basis entry type")
        qty = amount(entry["quantity"])
        price = amount(entry.get("unit_price_usd", 0), positive=False)
        fee = amount(entry.get("fee_usd", 0), positive=False)
        asset = str(entry["asset"]).upper()
        if len(asset) > 20 or not asset.isalnum(): raise ValueError("Invalid asset symbol")
        wallet_id = entry.get("wallet_id")
        if wallet_id and not any(w.get("id") == wallet_id for w in self.data.get("wallets", [])):
            raise ValueError("Wallet does not exist")
        lots = self.data.setdefault("cost_basis_lots", [])
        realized: Decimal | None = None; consumed: list[dict[str, str]] = []
        if kind in {"acquisition", "transfer_in", "adjustment"}:
            basis = qty * price + fee
            lots.append({"id": secrets.token_hex(10), "asset": asset, "wallet_id": wallet_id,
                         "acquired_at": entry.get("timestamp") or iso(), "original_quantity": str(qty),
                         "remaining_quantity": str(qty), "unit_cost_usd": str((basis / qty) if qty else 0),
                         "source_event_id": None})
        elif kind in {"disposal", "fee", "transfer_out"}:
            remaining = qty; basis_total = Decimal("0")
            candidates = sorted((x for x in lots if x.get("asset") == asset and
                                 (wallet_id is None or x.get("wallet_id") == wallet_id) and
                                 Decimal(str(x.get("remaining_quantity", "0"))) > 0), key=lambda x: x.get("acquired_at", ""))
            for lot in candidates:
                available = Decimal(str(lot["remaining_quantity"]))
                take = min(available, remaining)
                if take <= 0: continue
                basis = take * Decimal(str(lot["unit_cost_usd"]))
                lot["remaining_quantity"] = str(available - take); basis_total += basis; remaining -= take
                consumed.append({"lot_id": lot["id"], "quantity": str(take), "cost_basis_usd": str(basis)})
                if remaining == 0: break
            if remaining > 0: raise ValueError(f"Insufficient recorded lots; {remaining} {asset} lacks cost basis")
            realized = (qty * price - fee - basis_total) if kind in {"disposal", "fee"} else Decimal("0")
        record = {"id": secrets.token_hex(10), "kind": kind, "asset": asset, "quantity": str(qty),
                  "unit_price_usd": str(price), "fee_usd": str(fee), "wallet_id": wallet_id,
                  "timestamp": entry.get("timestamp") or iso(), "description": str(entry.get("description", ""))[:240],
                  "cost_basis_lots_consumed": consumed, "cost_basis_usd": str(sum((Decimal(x["cost_basis_usd"]) for x in consumed), Decimal("0"))),
                  "realized_gain_loss_usd": str(realized) if realized is not None else None}
        self.data.setdefault("cost_basis_events", []).append(record)
        if consumed:
            for lot in lots:
                for use in consumed:
                    if lot["id"] == use["lot_id"]: lot["source_event_id"] = record["id"]
        self.state.vault.save(); _event(self.state, f"cost_basis.{kind}", subject=record["id"])
        return record

    def cost_basis_summary(self) -> dict[str, Any]:
        lots = self.data.setdefault("cost_basis_lots", [])
        by_asset: dict[str, dict[str, Decimal]] = {}
        for lot in lots:
            asset = lot["asset"]; q = Decimal(str(lot["remaining_quantity"])); cost = q * Decimal(str(lot["unit_cost_usd"]))
            row = by_asset.setdefault(asset, {"quantity": Decimal("0"), "cost_basis_usd": Decimal("0")})
            row["quantity"] += q; row["cost_basis_usd"] += cost
        gains: dict[str, Decimal] = {}
        for event in self.data.setdefault("cost_basis_events", []):
            if event.get("realized_gain_loss_usd") is not None:
                gains[event["asset"]] = gains.get(event["asset"], Decimal("0")) + Decimal(str(event["realized_gain_loss_usd"]))
        valuations = {}
        for asset_record in self.data.setdefault("assets", {}).values():
            symbol = str(asset_record.get("symbol", "")).upper()
            price = asset_record.get("price_usd")
            if symbol and isinstance(price, (int, float)) and price > 0:
                valuations[symbol] = float(price)
        result_assets = {}
        for key, values in by_asset.items():
            price = valuations.get(key)
            market_value = (values["quantity"] * Decimal(str(price))) if price is not None else None
            unrealized = (market_value - values["cost_basis_usd"]) if market_value is not None else None
            result_assets[key] = {"quantity": str(values["quantity"]), "remaining_cost_basis_usd": str(values["cost_basis_usd"]),
                "realized_gain_loss_usd": str(gains.get(key, Decimal("0"))), "current_price_usd": price,
                "market_value_usd": str(market_value) if market_value is not None else None,
                "unrealized_gain_loss_usd": str(unrealized) if unrealized is not None else None}
        return {"method": "FIFO", "assets": result_assets,
                "warning": "User-entered ledger only; prices are from the last stored asset sync; not tax advice or a jurisdiction-specific tax calculation."}

    def cost_basis_csv(self) -> str:
        stream = io.StringIO(); writer = csv.DictWriter(stream, fieldnames=["timestamp", "kind", "asset", "quantity", "unit_price_usd", "fee_usd", "cost_basis_usd", "realized_gain_loss_usd", "wallet_id", "description"])
        writer.writeheader()
        for row in self.data.setdefault("cost_basis_events", []): writer.writerow({k: row.get(k, "") for k in writer.fieldnames})
        return stream.getvalue()

    # ---- Payment requests -----------------------------------------------------------
    def payment_requests(self) -> list[dict[str, Any]]:
        self.refresh_payment_request_statuses()
        return list(reversed(self.data.setdefault("payment_requests", [])))

    def create_payment_request(self, item: dict[str, Any]) -> dict[str, Any]:
        network = AddressBookService.normalize_network(item["network"])
        address = AddressBookService.validate_address(network, item["address"])
        qty = amount(item["amount"])
        expires = datetime.fromisoformat(item["expires_at"].replace("Z", "+00:00")) if item.get("expires_at") else now() + timedelta(days=7)
        if expires.tzinfo is None or expires <= now(): raise ValueError("Expiry must be a future timezone-aware timestamp")
        row = {"id": secrets.token_hex(10), "network": network, "asset": str(item.get("asset", "native")).upper(),
               "address": address, "amount": str(qty), "label": str(item.get("label", "Payment request"))[:80],
               "memo": str(item.get("memo", ""))[:240], "expires_at": expires.isoformat(),
               "status": "OPEN", "transaction_id": None, "created_at": iso()}
        self.data.setdefault("payment_requests", []).append(row)
        self.state.vault.save(); _event(self.state, "payment_request.created", subject=row["id"])
        return row

    def refresh_payment_request_statuses(self) -> int:
        changed = 0; current = now()
        for request in self.data.setdefault("payment_requests", []):
            if request.get("status") != "OPEN": continue
            try: expires = datetime.fromisoformat(request["expires_at"])
            except (ValueError, KeyError): continue
            if expires <= current: request["status"] = "EXPIRED"; changed += 1
            # Confirmed matches are only possible when an indexer has provided
            # a decoded destination+asset+amount. Unknown/ambiguous activity is ignored.
            for activity in self.data.get("activity", [])[-2000:]:
                if activity.get("status") not in {"CONFIRMED", "FINALIZED"}: continue
                if str(activity.get("network", "solana")).lower() != request["network"]: continue
                for transfer in (activity.get("native_transfers") or []) + (activity.get("token_transfers") or []):
                    dest = transfer.get("toUserAccount") or transfer.get("to") or transfer.get("to_address")
                    token = str(transfer.get("token_mint") or transfer.get("mint") or "native").upper()
                    try: received = amount(transfer.get("amount", 0), positive=False)
                    except ValueError: continue
                    if dest == request["address"] and token == request["asset"] and received >= Decimal(request["amount"]):
                        request["status"] = "PAID"; request["transaction_id"] = activity.get("signature") or activity.get("id"); changed += 1; break
                if request.get("status") != "OPEN": break
        if changed: self.state.vault.save()
        return changed

    # ---- Explorer / graph / local read-only assistant ------------------------------
    def explorer_url(self, network: str, kind: str, identifier: str) -> dict[str, Any]:
        n = AddressBookService.normalize_network(network); k = kind.lower()
        if k not in {"address", "tx", "transaction", "block"}: raise ValueError("Explorer item must be address, tx or block")
        if not identifier or len(identifier) > 256 or any(c.isspace() for c in identifier): raise ValueError("Invalid explorer identifier")
        templates = {
            "solana": "https://explorer.solana.com/{kind}/{id}",
            "bitcoin": "https://mempool.space/{kind}/{id}", "btc": "https://mempool.space/{kind}/{id}",
            "litecoin": "https://litecoinspace.org/{kind}/{id}", "ltc": "https://litecoinspace.org/{kind}/{id}",
            "dogecoin": "https://dogechain.info/{kind}/{id}", "doge": "https://dogechain.info/{kind}/{id}",
            "ethereum-classic": "https://etc.blockscout.com/{kind}/{id}", "etc": "https://etc.blockscout.com/{kind}/{id}",
            "ravencoin": "https://ravencoin.network/{kind}/{id}", "rvn": "https://ravencoin.network/{kind}/{id}",
            "ergo": "https://explorer.ergoplatform.com/{kind}/{id}", "kaspa": "https://explorer.kaspa.org/{kind}/{id}",
            "monero": "https://xmrchain.net/{kind}/{id}", "zano": "https://explorer.zano.org/{kind}/{id}",
        }
        template = templates.get(n)
        if not template: raise ValueError("No explorer URL is configured for this network")
        path_kind = "tx" if k == "transaction" else k
        if n in {"bitcoin", "btc", "litecoin", "ltc"} and path_kind == "tx": path_kind = "tx"
        url = template.format(kind=path_kind, id=quote(identifier, safe=""))
        return {"network": n, "kind": k, "identifier": identifier, "url": url, "provider_status": "EXTERNAL_LINK_TEMPLATE"}

    def wallet_graph(self) -> dict[str, Any]:
        wallets = self.data.get("wallets", []); address_to_wallet = {w.get("address"): w for w in wallets if w.get("address")}
        nodes: dict[str, dict[str, Any]] = {}; edges: dict[tuple[str, str], dict[str, Any]] = {}
        for w in wallets:
            key = w["address"]; nodes[key] = {"id": key, "label": w.get("label"), "wallet_id": w.get("id"), "type": "managed_wallet"}
        for tx in self.data.get("activity", [])[-5000:]:
            wallet = next((w for w in wallets if w.get("id") == tx.get("wallet_id")), None)
            if not wallet: continue
            src = wallet.get("address")
            for transfer in (tx.get("native_transfers") or []) + (tx.get("token_transfers") or []):
                a = transfer.get("fromUserAccount") or transfer.get("from") or src
                b = transfer.get("toUserAccount") or transfer.get("to")
                if not a or not b or a == b: continue
                nodes.setdefault(a, {"id": a, "label": "External address", "type": "external"})
                nodes.setdefault(b, {"id": b, "label": "External address", "type": "external"})
                key = (a, b); edge = edges.setdefault(key, {"source": a, "target": b, "transactions": 0, "last_seen": None})
                edge["transactions"] += 1; edge["last_seen"] = tx.get("block_time") or tx.get("created_at")
        return {"nodes": list(nodes.values()), "edges": list(edges.values()), "source": "indexed_activity", "coverage": "Only indexed activity in the current Solana sync adapter is represented."}

    def assistant(self, query: str) -> dict[str, Any]:
        q = query.strip().lower()
        if not q or len(q) > 500: raise ValueError("Question must be 1–500 characters")
        summary = {"total_value_usd": 0.0, "wallet_count": len(self.data.get("wallets", [])), "asset_count": len(self.data.get("assets", {}))}
        for asset in self.data.get("assets", {}).values():
            for holding in asset.get("holdings", {}).values():
                if isinstance(holding.get("value_usd"), (int, float)): summary["total_value_usd"] += float(holding["value_usd"])
        if any(x in q for x in ("portfolio", "worth", "value", "total")):
            answer = f"The latest locally recorded portfolio value is ${summary['total_value_usd']:,.2f} across {summary['asset_count']} assets and {summary['wallet_count']} wallets. Values may be stale until reconciliation completes."
        elif "wallet" in q:
            answer = f"The vault contains {summary['wallet_count']} wallet(s). Wallet addresses and balances are available in the Wallets and Reconciliation sections."
        elif "transaction" in q or "activity" in q:
            answer = f"The vault currently stores {len(self.data.get('activity', []))} indexed activity records and {len(self.data.get('execution_records', []))} execution records."
        elif "fee" in q:
            answer = "Network fee estimates are only shown when a chain-specific provider supplies a current quote. No fee is guessed by this assistant."
        else:
            answer = "I can answer read-only questions about portfolio totals, wallet counts, indexed transaction counts and fee-data availability. I cannot sign, send, trade or change wallet data."
        _event(self.state, "assistant.query", details={"query_length": len(query)})
        return {"answer": answer, "mode": "LOCAL_READ_ONLY", "can_sign": False, "can_broadcast": False, "generated_at": iso()}

    # ---- Fee quote cache ------------------------------------------------------------
    def fee_quotes(self, network: str | None = None) -> list[dict[str, Any]]:
        # Never mutate the encrypted vault while rendering a read-only list.
        rows = [dict(x) for x in self.data.setdefault("fee_quotes", [])]
        if network:
            normalized = AddressBookService.normalize_network(network)
            rows = [x for x in rows if x.get("network") == normalized]
        return sorted(rows, key=lambda x: x.get("observed_at", ""), reverse=True)

    def save_fee_quote(self, row: dict[str, Any]) -> dict[str, Any]:
        network = AddressBookService.normalize_network(row["network"])
        fee = amount(row["fee"], positive=False)
        ttl = int(row.get("ttl_seconds", 60))
        if ttl < 1 or ttl > 3600: raise ValueError("Fee quote TTL must be 1–3600 seconds")
        item = {"id": secrets.token_hex(10), "network": network, "fee": str(fee), "unit": str(row["unit"])[:16],
                "target": str(row.get("target", "normal"))[:32], "source": str(row["source"])[:80],
                "observed_at": iso(), "expires_at": (now() + timedelta(seconds=ttl)).isoformat(), "ttl_seconds": ttl}
        self.data.setdefault("fee_quotes", []).append(item); del self.data["fee_quotes"][:-1000]
        self.state.vault.save(); return item

    # ---- Limit orders as alert-only intents; no automatic trade execution -------------
    def limit_orders(self) -> list[dict[str, Any]]:
        return list(reversed(self.data.setdefault("limit_orders", [])))

    def create_limit_order(self, item: dict[str, Any]) -> dict[str, Any]:
        side = str(item["side"]).lower()
        if side not in {"buy", "sell"}: raise ValueError("Limit order side must be buy or sell")
        target = amount(item["target_price"])
        asset = str(item["asset"]).upper()
        if not asset.isalnum() or len(asset) > 20: raise ValueError("Invalid asset symbol")
        qty = amount(item["quantity"])
        row = {"id": secrets.token_hex(10), "asset": asset, "side": side,
               "target_price_usd": str(target), "quantity": str(qty),
               "status": "OPEN", "created_at": iso(), "triggered_at": None,
               "execution_enabled": False, "approval_required": True}
        self.data.setdefault("limit_orders", []).append(row)
        self.state.vault.save(); _event(self.state, "limit_order.created", subject=row["id"])
        return row

    def evaluate_limit_orders(self) -> dict[str, int]:
        assets = self.data.setdefault("assets", {})
        triggered = 0
        for row in self.data.setdefault("limit_orders", []):
            if row.get("status") != "OPEN": continue
            asset = next((a for a in assets.values() if str(a.get("symbol", "")).upper() == row["asset"] or str(a.get("mint", "")).upper() == row["asset"]), None)
            price = asset.get("price_usd") if asset else None
            if not isinstance(price, (int, float)) or price <= 0: continue
            target = float(row["target_price_usd"])
            if (row["side"] == "buy" and float(price) <= target) or (row["side"] == "sell" and float(price) >= target):
                row["status"] = "TRIGGERED_REQUIRES_MANUAL_REVIEW"; row["triggered_at"] = iso(); row["observed_price_usd"] = float(price)
                triggered += 1
                _event(self.state, "limit_order.triggered", subject=row["id"], details={"execution_enabled": False})
        if triggered: self.state.vault.save()
        return {"checked": sum(1 for x in self.data.setdefault("limit_orders", []) if x.get("status") == "OPEN") + triggered,
                "triggered_for_review": triggered, "executed": 0}

    def cancel_limit_order(self, order_id: str) -> dict[str, Any]:
        row = next((x for x in self.data.setdefault("limit_orders", []) if x.get("id") == order_id), None)
        if not row: raise KeyError("Limit order not found")
        if row.get("status") != "OPEN": raise ValueError("Only open limit orders can be cancelled")
        row["status"] = "CANCELLED"; row["updated_at"] = iso()
        self.state.vault.save(); _event(self.state, "limit_order.cancelled", subject=order_id)
        return row

    # ---- Encrypted metadata synchronization; secrets never included ----------------
    def export_metadata(self, passphrase: str) -> str:
        if len(passphrase) < 12: raise ValueError("Sync passphrase must be at least 12 characters")
        payload = {key: self.data.get(key, []) for key in self.SYNC_KEYS}
        payload["format"] = "nexus-metadata-sync-v1"; payload["created_at"] = iso()
        salt, nonce = secrets.token_bytes(16), secrets.token_bytes(12)
        key = _derive_argon2id(passphrase, salt)
        cipher = AESGCM(key).encrypt(nonce, json.dumps(payload, separators=(",", ":")).encode(), b"nexus-metadata-sync-v1")
        envelope = {"format": "nexus-metadata-sync-v1", "kdf": "Argon2id", "salt": base64.b64encode(salt).decode(),
                    "nonce": base64.b64encode(nonce).decode(), "ciphertext": base64.b64encode(cipher).decode()}
        _event(self.state, "metadata_sync.exported")
        return base64.b64encode(json.dumps(envelope, separators=(",", ":")).encode()).decode()

    def import_metadata(self, bundle: str, passphrase: str, merge: bool = True) -> dict[str, Any]:
        try:
            envelope = json.loads(base64.b64decode(bundle, validate=True))
            if envelope.get("format") != "nexus-metadata-sync-v1": raise ValueError
            key = _derive_argon2id(passphrase, base64.b64decode(envelope["salt"]))
            plain = AESGCM(key).decrypt(base64.b64decode(envelope["nonce"]), base64.b64decode(envelope["ciphertext"]), b"nexus-metadata-sync-v1")
            payload = json.loads(plain)
            if payload.get("format") != "nexus-metadata-sync-v1": raise ValueError
        except Exception as exc: raise ValueError("Sync bundle is invalid or passphrase is incorrect") from exc
        imported = {}
        for key_name in self.SYNC_KEYS:
            incoming = payload.get(key_name, [] if key_name != "transaction_policy" else {})
            if key_name == "transaction_policy":
                if not merge or not self.data.get(key_name): self.data[key_name] = incoming
                imported[key_name] = 1 if incoming else 0
                continue
            current = self.data.setdefault(key_name, [])
            if not isinstance(incoming, list): raise ValueError("Sync bundle payload has an invalid structure")
            if merge:
                existing = {x.get("id") for x in current if isinstance(x, dict)}
                additions = [x for x in incoming if isinstance(x, dict) and x.get("id") not in existing]
                current.extend(additions); imported[key_name] = len(additions)
            else:
                self.data[key_name] = incoming; imported[key_name] = len(incoming)
        self.state.vault.save(); _event(self.state, "metadata_sync.imported", details={"collections": len(imported)})
        return {"imported": imported, "private_keys_included": False, "mode": "MERGE" if merge else "REPLACE_METADATA_ONLY"}

    # ---- Portfolio analytics from reconciled vault records ---------------------------
    def portfolio_analytics(self) -> dict[str, Any]:
        holdings = []
        total = Decimal("0")
        for asset in self.data.setdefault("assets", {}).values():
            symbol = str(asset.get("symbol") or asset.get("name") or asset.get("mint") or "UNKNOWN")
            price = asset.get("price_usd")
            for wallet_id, holding in (asset.get("holdings") or {}).items():
                value = holding.get("value_usd")
                amount_value = holding.get("amount")
                if isinstance(value, (int, float)):
                    usd_value = Decimal(str(value)); total += usd_value
                elif isinstance(price, (int, float)) and isinstance(amount_value, (int, float)):
                    usd_value = Decimal(str(price)) * Decimal(str(amount_value)); total += usd_value
                else:
                    usd_value = None
                holdings.append({"symbol": symbol, "wallet_id": wallet_id, "amount": amount_value,
                                 "value_usd": str(usd_value) if usd_value is not None else None,
                                 "price_usd": price, "updated_at": holding.get("updated_at"),
                                 "source": holding.get("source")})
        by_symbol: dict[str, Decimal] = {}
        for row in holdings:
            if row["value_usd"] is not None:
                by_symbol[row["symbol"]] = by_symbol.get(row["symbol"], Decimal("0")) + Decimal(row["value_usd"])
        allocation = [{"asset": k, "value_usd": str(v), "percent": float(v / total * 100) if total else 0.0}
                      for k, v in sorted(by_symbol.items(), key=lambda item: item[1], reverse=True)]
        basis = self.cost_basis_summary()
        realized = sum((Decimal(str(x.get("realized_gain_loss_usd", "0"))) for x in basis["assets"].values()), Decimal("0"))
        unrealized_values = [Decimal(str(x["unrealized_gain_loss_usd"])) for x in basis["assets"].values() if x.get("unrealized_gain_loss_usd") is not None]
        unrealized = sum(unrealized_values, Decimal("0"))
        return {"total_value_usd": str(total), "valued_holding_count": sum(1 for x in holdings if x["value_usd"] is not None),
                "unvalued_holding_count": sum(1 for x in holdings if x["value_usd"] is None),
                "allocation": allocation, "holdings": holdings,
                "realized_gain_loss_usd": str(realized), "unrealized_gain_loss_usd": str(unrealized),
                "cost_basis_method": "FIFO_USER_ENTERED_LEDGER",
                "last_portfolio_snapshot": (self.data.get("portfolio_snapshots") or [None])[-1],
                "reconciliation": self.data.get("reconciliation", {}).get("last_report", {}).get("status", "NOT_RUN")}

    # ---- Security alerts, audit exports and recovery checks ------------------------
    def security_alerts(self) -> list[dict[str, Any]]:
        """Return conservative, explainable review signals; never label them as fraud verdicts."""
        acknowledgements = set(self.data.setdefault("security_alert_acknowledgements", []))
        rows: list[dict[str, Any]] = []
        contacts = {(x.get("network"), x.get("address")): x for x in self.data.get("address_book", [])}
        for record in self.data.get("execution_records", [])[-500:]:
            state = str(record.get("state", "")).upper()
            record_id = str(record.get("id", "unknown"))
            created = record.get("created_at") or record.get("updated_at") or iso()
            def append(code: str, severity: str, title: str, detail: str) -> None:
                alert_id = hashlib.sha256(f"{code}:{record_id}".encode()).hexdigest()[:20]
                rows.append({"id": alert_id, "code": code, "severity": severity, "title": title,
                             "detail": detail, "record_id": record_id, "created_at": created,
                             "acknowledged": alert_id in acknowledgements})
            if state == "FAILED":
                append("EXECUTION_FAILED", "medium", "Transaction attempt failed",
                       "Review the transaction record and network response before retrying.")
            if record.get("broadcasted") and not record.get("confirmed") and state not in {"FAILED", "CONFIRMED"}:
                try:
                    stamp = datetime.fromisoformat(str(record.get("updated_at") or created).replace("Z", "+00:00"))
                    if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=timezone.utc)
                    age_minutes = (now() - stamp).total_seconds() / 60
                except ValueError:
                    age_minutes = 0
                if age_minutes >= 2:
                    append("BROADCAST_NOT_CONFIRMED", "high", "Broadcast has no confirmation yet",
                           "The transaction may still be pending. Check the blockchain explorer before considering another send.")
            network = str(record.get("network", "solana")).lower()
            destination = record.get("destination")
            if destination and state in {"SIGNED", "BROADCASTED", "CONFIRMED"} and not contacts.get((network, destination), {}).get("trusted"):
                append("UNTRUSTED_EXECUTED_DESTINATION", "medium", "Transaction used an untrusted destination",
                       "This destination was not marked as trusted in the address book when the transaction record was checked.")
        return sorted((x for x in rows if not x["acknowledged"]), key=lambda x: ({"high": 0, "medium": 1, "low": 2}.get(x["severity"], 3), x["created_at"]), reverse=False)

    def acknowledge_security_alert(self, alert_id: str) -> dict[str, Any]:
        known = {x["id"] for x in self.security_alerts()}
        # Permit idempotent acknowledgement when already acknowledged.
        stored = self.data.setdefault("security_alert_acknowledgements", [])
        if alert_id not in known and alert_id not in stored:
            raise KeyError("Security alert not found")
        if alert_id not in stored:
            stored.append(alert_id)
            del stored[:-2000]
            self.state.vault.save()
            _event(self.state, "security_alert.acknowledged", subject=alert_id)
        return {"id": alert_id, "acknowledged": True}

    def backup_inventory(self, verify_hashes: bool = False) -> list[dict[str, Any]]:
        folder = self.state.vault.path.parent / "backups"
        if not folder.exists():
            return []
        result = []
        for path in sorted(folder.glob("*.svault"), key=lambda p: p.stat().st_mtime, reverse=True):
            # Never follow links outside the vault-owned backup directory.
            if path.is_symlink() or not path.is_file():
                continue
            manifest_path = path.with_suffix(path.suffix + ".manifest.json")
            item: dict[str, Any] = {"name": path.name, "bytes": path.stat().st_size,
                                    "modified_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                                    "encrypted_vault_copy": True, "manifest_present": manifest_path.is_file(),
                                    "integrity": "NOT_CHECKED"}
            if manifest_path.is_file():
                try:
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    item["manifest"] = {"created_at": manifest.get("created_at"), "sha256": manifest.get("sha256"),
                                        "bytes": manifest.get("bytes")}
                    if verify_hashes:
                        digest = hashlib.sha256(path.read_bytes()).hexdigest()
                        item["integrity"] = "MATCH" if digest == manifest.get("sha256") and path.stat().st_size == manifest.get("bytes") else "MISMATCH"
                except (OSError, ValueError, TypeError):
                    item["integrity"] = "MANIFEST_INVALID"
            elif verify_hashes:
                item["integrity"] = "MANIFEST_MISSING"
            result.append(item)
        return result

    def recovery_checklist(self) -> dict[str, Any]:
        backups = self.backup_inventory(False)
        wallet_count = len(self.data.get("wallets", []))
        has_watch_only = any(x.get("watch_only") for x in self.data.get("wallets", []))
        return {"wallet_count": wallet_count, "backup_count": len(backups),
                "newest_backup": backups[0]["modified_at"] if backups else None,
                "automatic_backups_enabled": bool(self.data.setdefault("settings", {}).get("automatic_backups_enabled", False)),
                "recommended_steps": [
                    "Keep the vault password and any recovery phrases outside this computer.",
                    "Create an encrypted vault backup and store a copy offline.",
                    "Verify a backup's SHA-256 manifest before relying on it.",
                    "Test restoration using a separate disposable data directory before deleting the original vault.",
                    "Watch-only wallets do not contain signing secrets; independently verify the original source wallet recovery material.",
                ], "watch_only_wallet_present": has_watch_only,
                "restore_tested_by_application": False,
                "warning": "A matching SHA-256 manifest checks file integrity, not whether you know the vault password or can recover an external seed phrase."}

    def execution_history_csv(self) -> str:
        fields = ["created_at", "updated_at", "state", "wallet_id", "destination", "amount", "asset_mint",
                  "signature", "broadcasted", "confirmed", "reason"]
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in self.data.get("execution_records", []):
            writer.writerow({key: row.get(key, "") for key in fields})
        return stream.getvalue()

    def exchange_history(self) -> list[dict[str, Any]]:
        swaps = [dict(x) for x in self.data.get("execution_records", [])
                 if x.get("output_mint") or x.get("quote")]
        return sorted(swaps, key=lambda x: x.get("created_at", ""), reverse=True)[:500]

    def network_capabilities(self) -> list[dict[str, Any]]:
        from ..chains.registry import list_networks

        rows = []
        for item in list_networks():
            is_solana = item["family"] == "solana"
            capability_set = set(item["capabilities"])
            rows.append({
                "network": item["id"],
                "chain": item["chain"],
                "family": item["family"],
                "name": item["name"],
                "symbol": item["symbol"],
                "status": item["status"],
                "capabilities": item["capabilities"],
                "wallet_read": "LIVE" if is_solana else (
                    "READ_ONLY_PARTIAL" if "native_balance" in capability_set else "NOT_IMPLEMENTED"
                ),
                "send": "PARTIAL_LIVE_BROADCAST_DISABLED_BY_DEFAULT" if is_solana else "DISABLED",
                "swap": "JUPITER_PROVIDER_ONLY" if is_solana else "NOT_IMPLEMENTED",
                "reconciliation": "LIVE" if is_solana else (
                    "READ_ONLY_PARTIAL" if "native_balance" in capability_set else "NOT_IMPLEMENTED"
                ),
            })
        return rows

    # ---- Security center ------------------------------------------------------------
    def security_summary(self) -> dict[str, Any]:
        wallets = self.data.get("wallets", [])
        watch_only = sum(1 for x in wallets if x.get("watch_only"))
        signable = sum(1 for x in wallets if x.get("signing_enabled") and not x.get("watch_only"))
        trusted = sum(1 for x in self.data.get("address_book", []) if x.get("trusted"))
        policy = self.get_policy()
        backup_dir = self.state.vault.path.parent / "backups"
        backup_count = len(list(backup_dir.glob("*.svault"))) if backup_dir.exists() else 0
        return {"wallet_count": len(wallets), "watch_only_wallets": watch_only, "signing_enabled_wallets": signable,
                "trusted_recipients": trusted, "recipient_confirmation_enabled": policy["require_new_recipient_confirmation"],
                "require_trusted_recipient": policy["require_trusted_recipient"], "backup_count": backup_count,
                "live_broadcast_enabled": False, "hardware_wallet_integration": "NOT_CONFIGURED_BY_USER_REQUEST",
                "last_audit_events": list(reversed(self.data.setdefault("security_events", [])[-50:])),
                "status": "REVIEW_REQUIRED" if signable else "WATCH_ONLY"}