from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .service import SyncService


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PortfolioReconciliationService:
    """Read-only reconciliation for networks with a configured sync adapter.

    At present the underlying SyncService is Solana-specific. The response
    explicitly reports that scope rather than implying other chains were read.
    """

    NETWORK = "solana"

    def __init__(self, state) -> None:
        self.state = state

    def _wallet_balances(self, wallet_id: str) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for mint, asset in self.state.vault.data().get("assets", {}).items():
            holding = asset.get("holdings", {}).get(wallet_id)
            if not holding:
                continue
            result[mint] = {
                "symbol": asset.get("symbol") or ("SOL" if mint == "SOL" else None),
                "amount": holding.get("amount"),
                "decimals": holding.get("decimals", asset.get("decimals")),
                "updated_at": holding.get("updated_at"),
                "slot": holding.get("slot"),
                "source": holding.get("source", "unknown"),
            }
        return result

    async def reconcile(self) -> dict[str, Any]:
        if not self.state.vault.unlocked:
            raise RuntimeError("Vault must be unlocked before reconciliation")

        sync = SyncService(self.state)
        wallet_result = await sync.sync_wallets()
        activity_result = await sync.sync_activity()

        data = self.state.vault.data()
        wallets = [wallet for wallet in data.get("wallets", []) if (wallet.get("chain") or "solana") == "solana"]
        previous = data.setdefault("reconciliation", {})
        previous_wallets = previous.setdefault("wallets", {})
        snapshots = previous.setdefault("snapshots", [])
        activity = data.get("activity", [])

        wallet_reports: list[dict[str, Any]] = []
        detected: list[dict[str, Any]] = []
        failed_wallet_ids = {str(x.get("wallet_id")) for x in wallet_result.get("failed_wallets", [])}
        for wallet in wallets:
            wallet_id = wallet.get("id")
            if not wallet_id:
                continue
            balances = self._wallet_balances(wallet_id)
            old = previous_wallets.get(wallet_id, {}).get("balances", {})
            changes = []
            for asset_id in sorted(set(old) | set(balances)):
                before = old.get(asset_id, {}).get("amount", 0) or 0
                after = balances.get(asset_id, {}).get("amount", 0) or 0
                try:
                    delta = float(after) - float(before)
                except (TypeError, ValueError):
                    delta = None
                if delta is not None and abs(delta) > 0:
                    changes.append({"asset_id": asset_id, "previous": before, "current": after, "delta": delta})

            old_seen = set(previous_wallets.get(wallet_id, {}).get("seen_activity_ids", []))
            current_activity = [x for x in activity if str(x.get("wallet_id")) == str(wallet_id)]
            new_activity = [x for x in current_activity if str(x.get("id") or x.get("signature")) not in old_seen]
            for item in new_activity:
                wallet_changes = item.get("wallet_changes") or {}
                incoming = wallet_changes.get("incoming") or []
                outgoing = wallet_changes.get("outgoing") or []
                if not incoming and not outgoing:
                    address = wallet.get("address")
                    for change in item.get("native_changes") or []:
                        if change.get("address") == address:
                            (incoming if float(change.get("delta_lamports", 0)) > 0 else outgoing).append(change)
                    for change in item.get("token_changes") or []:
                        if change.get("owner") == address:
                            (incoming if float(change.get("delta", 0)) > 0 else outgoing).append(change)
                    for change in item.get("native_transfers") or []:
                        if change.get("toUserAccount") == address or change.get("to") == address:
                            incoming.append(change)
                        if change.get("fromUserAccount") == address or change.get("from") == address:
                            outgoing.append(change)
                    for change in item.get("token_transfers") or []:
                        if change.get("toUserAccount") == address or change.get("to") == address:
                            incoming.append(change)
                        if change.get("fromUserAccount") == address or change.get("from") == address:
                            outgoing.append(change)
                direction = "mixed" if incoming and outgoing else "incoming" if incoming else "outgoing" if outgoing else "unknown"
                detected.append({
                    "wallet_id": wallet_id,
                    "wallet_label": wallet.get("label"),
                    "transaction_id": item.get("signature") or item.get("id"),
                    "type": item.get("type") or item.get("event_type") or "TRANSACTION",
                    "direction": direction,
                    "incoming_change_count": len(incoming),
                    "outgoing_change_count": len(outgoing),
                    "status": item.get("status", "UNKNOWN"),
                    "block_time": item.get("block_time"),
                    "confirmation_status": item.get("confirmation_status"),
                    "source": item.get("source", "chain_indexer"),
                })

            wallet_reports.append({
                "wallet_id": wallet_id,
                "wallet_label": wallet.get("label"),
                "network": self.NETWORK,
                "balance_status": "STALE" if wallet_result.get("status") == "NO_RPC" or str(wallet_id) in failed_wallet_ids else "FRESH",
                "balances": balances,
                "balance_changes_since_previous_reconciliation": changes,
                "new_transactions_detected": len(new_activity),
            })
            previous_wallets[wallet_id] = {
                "balances": balances,
                "seen_activity_ids": sorted(old_seen | {str(x.get("id") or x.get("signature")) for x in current_activity if x.get("id") or x.get("signature")}),
                "reconciled_at": _now(),
            }

        report = {
            "id": _now(),
            "network": self.NETWORK,
            "status": "RECONCILED" if wallet_result.get("status") == "SYNCED" and activity_result.get("status") == "SYNCED" else "PARTIAL",
            "scope": "solana_only_current_adapter",
            "read_only": True,
            "wallet_count": len(wallet_reports),
            "new_transactions_detected": len(detected),
            "wallet_sync": wallet_result,
            "activity_sync": activity_result,
            "wallets": wallet_reports,
            "detected_transactions": detected[-500:],
            "reconciled_at": _now(),
        }
        snapshots.append({
            "reconciled_at": report["reconciled_at"],
            "network": self.NETWORK,
            "wallet_count": len(wallet_reports),
            "new_transactions_detected": len(detected),
            "status": report["status"],
        })
        del snapshots[:-1000]
        previous["last_report"] = report
        self.state.vault.save()
        await self.state.emit("portfolio.reconciled", {
            "status": report["status"],
            "network": self.NETWORK,
            "wallet_count": len(wallet_reports),
            "new_transactions_detected": len(detected),
            "reconciled_at": report["reconciled_at"],
        })
        return report

    def latest(self) -> dict[str, Any]:
        return self.state.vault.data().get("reconciliation", {}).get("last_report", {
            "status": "NOT_RUN", "scope": "solana_only_current_adapter", "read_only": True,
        })

    def history(self, limit: int = 100) -> list[dict[str, Any]]:
        rows = self.state.vault.data().get("reconciliation", {}).get("snapshots", [])
        return list(reversed(rows[-max(1, min(limit, 500)):]))