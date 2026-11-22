from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from ..core.assets import AssetService
from ..core.transaction_decoder import decode_transaction
from ..core.token2022 import normalize_extensions
from ..providers.registry import ProviderRegistry
from ..rpc.pool import RPCPool
from ..solana.client import SolanaRPCClient, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SyncService:
    """Single source for read-only on-chain synchronization."""

    def __init__(self, state) -> None:
        self.state = state

    def rpc_pool(self) -> RPCPool:
        pool = self.state.services.get("rpc_pool")
        if pool is not None:
            return pool

        config = self.state.vault.data().get("rpc", {}).get("networks", [])
        pool = RPCPool(config)
        if not config:
            env_url = os.getenv("SOLANA_RPC_URL")
            if env_url:
                pool.add(
                    url=env_url,
                    network=os.getenv("SOLANA_RPC_NETWORK", "mainnet-beta"),
                    metadata={"source": "environment"},
                )
        self.state.services["rpc_pool"] = pool
        return pool

    def provider_registry(self) -> ProviderRegistry:
        registry = self.state.services.get("provider_registry")
        if registry is None:
            registry = ProviderRegistry(self.state.vault.data().get("providers", {}))
            self.state.services["provider_registry"] = registry
        return registry

    def client(self) -> SolanaRPCClient:
        return SolanaRPCClient(
            self.rpc_pool(),
            network=os.getenv("SOLANA_RPC_NETWORK", "mainnet-beta"),
        )

    def _remember(self, kind: str, result: dict[str, Any]) -> dict[str, Any]:
        self.state.services.setdefault("sync_status", {})[kind] = result
        return result

    async def sync_wallets(self) -> dict[str, Any]:
        wallets = [wallet for wallet in self.state.vault.data().get("wallets", []) if (wallet.get("chain") or "solana") == "solana"]
        client = self.client()
        pool = self.rpc_pool()

        if not pool.candidates(client.network):
            await pool.probe_all()
        if not pool.candidates(client.network):
            result = {
                "status": "NO_RPC",
                "wallet_count": len(wallets),
                "detail": "No usable Solana RPC endpoint is configured.",
            }
            await self.state.emit("sync.wallets", result)
            return self._remember("wallets", result)

        assets = AssetService(self.state)
        synced = 0
        failures: list[dict[str, str]] = []

        for wallet in wallets:
            wallet_id = wallet.get("id")
            address = wallet.get("address")
            if not wallet_id or not address:
                continue

            try:
                balance = await client.get_balance(address)
                context_slot = int(balance.get("context", {}).get("slot", 0))
                lamports = int(balance.get("value", 0))
                assets.upsert_holding(
                    wallet_id=wallet_id,
                    mint="SOL",
                    amount=lamports / 1_000_000_000,
                    decimals=9,
                    token_account=None,
                    program="system",
                    slot=context_slot,
                )

                token_accounts = await client.get_token_accounts(address)
                seen_mints: set[str] = set()
                for item in token_accounts:
                    parsed = item.get("account", {}).get("data", {}).get("parsed", {})
                    info = parsed.get("info", {})
                    token_amount = info.get("tokenAmount", {})
                    mint = info.get("mint")
                    if not mint:
                        continue

                    decimals = int(token_amount.get("decimals", 0))
                    raw_amount = int(token_amount.get("amount", 0))
                    amount = raw_amount / (10 ** decimals) if decimals else float(raw_amount)
                    seen_mints.add(mint)
                    owner_program = item.get("account", {}).get("owner") or TOKEN_PROGRAM_ID
                    parsed_extensions = normalize_extensions(item.get("account")) if owner_program == TOKEN_2022_PROGRAM_ID else {}
                    assets.upsert_holding(
                        wallet_id=wallet_id,
                        mint=mint,
                        amount=amount,
                        decimals=decimals,
                        token_account=item.get("pubkey"),
                        program=owner_program,
                        slot=context_slot,
                    )
                    holding = self.state.vault.data()["assets"][mint]["holdings"][wallet_id]
                    holding["token_program"] = owner_program
                    if owner_program == TOKEN_2022_PROGRAM_ID:
                        holding["token_2022_extensions"] = parsed_extensions

                for mint, asset in list(self.state.vault.data().get("assets", {}).items()):
                    if wallet_id in asset.get("holdings", {}) and mint != "SOL" and mint not in seen_mints:
                        assets.remove_wallet_holding(wallet_id=wallet_id, mint=mint)

                synced += 1
                await self.state.emit(
                    "sync.wallet",
                    {"status": "SYNCED", "wallet_id": wallet_id, "slot": context_slot},
                )
            except Exception as exc:
                failures.append({"wallet_id": str(wallet_id), "error": type(exc).__name__})

        self.state.vault.save()
        result = {
            "status": "SYNCED" if not failures else "PARTIAL",
            "wallet_count": len(wallets),
            "synced_wallets": synced,
            "failed_wallets": failures,
            "updated_at": now_iso(),
        }
        await self.state.emit("sync.wallets", result)
        return self._remember("wallets", result)

    async def sync_activity(self) -> dict[str, Any]:
        wallets = [wallet for wallet in self.state.vault.data().get("wallets", []) if (wallet.get("chain") or "solana") == "solana"]
        client = self.client()
        pool = self.rpc_pool()

        if not pool.candidates(client.network):
            await pool.probe_all()
        if not pool.candidates(client.network):
            result = {"status": "NO_RPC", "wallet_count": len(wallets)}
            await self.state.emit("sync.activity", result)
            return self._remember("activity", result)

        activity = self.state.vault.data().setdefault("activity", [])
        existing_signatures = {str(item.get("signature")) for item in activity if item.get("signature")}
        added = 0
        decoded = 0
        failures: list[dict[str, str]] = []
        helius = self.provider_registry().get("helius")
        helius_ready = bool(getattr(helius, "configured", lambda: False)())

        for wallet in wallets:
            wallet_id = wallet.get("id")
            address = wallet.get("address")
            if not wallet_id or not address:
                continue
            try:
                entries = await client.get_signatures(address, limit=50)
                new_entries = [
                    entry for entry in entries
                    if entry.get("signature") and entry.get("signature") not in existing_signatures
                ]
                parsed_by_signature: dict[str, dict[str, Any]] = {}
                if helius_ready:
                    try:
                        parsed = await helius.parse_transactions(
                            [entry["signature"] for entry in new_entries][:100]
                        )
                        for item in parsed:
                            signature = item.get("signature")
                            if signature:
                                parsed_by_signature[str(signature)] = item
                    except Exception:
                        parsed_by_signature = {}

                for entry in new_entries:
                    signature = str(entry["signature"])
                    parsed = parsed_by_signature.get(signature)
                    if parsed:
                        item = {
                            "id": signature,
                            "type": parsed.get("type") or "TRANSACTION",
                            "event_type": parsed.get("type") or "TRANSACTION",
                            "description": parsed.get("description"),
                            "status": "FAILED" if parsed.get("error") else "CONFIRMED",
                            "wallet_id": wallet_id,
                            "signature": signature,
                            "slot": entry.get("slot") or parsed.get("slot"),
                            "block_time": entry.get("blockTime") or parsed.get("timestamp"),
                            "confirmation_status": entry.get("confirmationStatus"),
                            "fee_lamports": parsed.get("fee"),
                            "native_transfers": parsed.get("nativeTransfers", []),
                            "token_transfers": parsed.get("tokenTransfers", []),
                            "account_data": parsed.get("accountData", []),
                            "instructions": parsed.get("instructions", []),
                            "source": "helius_parsed_events",
                            "created_at": now_iso(),
                        }
                        decoded += 1
                    else:
                        raw_tx = await client.get_transaction(signature)
                        decoded_tx = decode_transaction(raw_tx, wallet_address=address) if raw_tx else {}
                        item = {
                            "id": signature,
                            "type": decoded_tx.get("event_type", "TRANSACTION"),
                            "event_type": decoded_tx.get("event_type", "TRANSACTION"),
                            "status": decoded_tx.get("status") or ("FAILED" if entry.get("err") else "CONFIRMED"),
                            "wallet_id": wallet_id,
                            "signature": signature,
                            "slot": entry.get("slot"),
                            "block_time": entry.get("blockTime"),
                            "confirmation_status": entry.get("confirmationStatus"),
                            "error": entry.get("err") or decoded_tx.get("error"),
                            "fee_lamports": decoded_tx.get("fee_lamports"),
                            "fee_sol": decoded_tx.get("fee_sol"),
                            "counterparties": decoded_tx.get("counterparties", []),
                            "program_ids": decoded_tx.get("program_ids", []),
                            "instructions": decoded_tx.get("instructions", []),
                            "native_changes": decoded_tx.get("native_changes", []),
                            "token_changes": decoded_tx.get("token_changes", []),
                            "compute_units_consumed": decoded_tx.get("compute_units_consumed"),
                            "source": "solana_rpc_decoder",
                            "created_at": now_iso(),
                        }
                        decoded += 1
                    activity.append(item)
                    existing_signatures.add(signature)
                    added += 1
            except Exception as exc:
                failures.append({"wallet_id": str(wallet_id), "error": type(exc).__name__})

        self.state.vault.save()
        result = {
            "status": "SYNCED" if not failures else "PARTIAL",
            "wallet_count": len(wallets),
            "added": added,
            "decoded": decoded,
            "failed_wallets": failures,
            "updated_at": now_iso(),
        }
        await self.state.emit("sync.activity", result)
        return self._remember("activity", result)

    async def sync_prices(self) -> dict[str, Any]:
        providers = self.provider_registry()
        priced = 0
        unresolved = 0
        assets = self.state.vault.data().get("assets", {})
        for mint, asset in assets.items():
            lookup_mint = "So11111111111111111111111111111111111111112" if mint == "SOL" else mint
            price = await providers.token_price(lookup_mint)
            if price is None:
                unresolved += 1
                continue
            for holding in asset.get("holdings", {}).values():
                holding["price_usd"] = price
                amount = holding.get("amount")
                holding["value_usd"] = float(amount) * price if isinstance(amount, (int, float)) else None
                holding["updated_at"] = now_iso()
            asset["price_usd"] = price
            asset["updated_at"] = now_iso()
            priced += 1
        self.state.vault.save()
        result = {
            "status": "SYNCED" if unresolved == 0 else ("PARTIAL" if priced else "UNAVAILABLE"),
            "priced_assets": priced,
            "unresolved_assets": unresolved,
            "updated_at": now_iso(),
        }
        await self.state.emit("sync.prices", result)
        return self._remember("prices", result)

    async def sync_metadata(self) -> dict[str, Any]:
        providers = self.provider_registry()
        updated = 0
        unresolved = 0
        for mint, asset in self.state.vault.data().get("assets", {}).items():
            if mint == "SOL" or (asset.get("symbol") and asset.get("name") and asset.get("metadata")):
                continue
            metadata = await providers.token_metadata(mint)
            if not metadata:
                unresolved += 1
                continue
            asset["metadata"] = metadata
            asset["symbol"] = asset.get("symbol") or metadata.get("symbol")
            asset["name"] = asset.get("name") or metadata.get("name")
            if metadata.get("decimals") is not None:
                asset["decimals"] = metadata.get("decimals")
            if metadata.get("price_usd") is not None:
                asset["price_usd"] = metadata.get("price_usd")
            asset["updated_at"] = now_iso()
            updated += 1
        self.state.vault.save()
        result = {
            "status": "SYNCED" if unresolved == 0 else ("PARTIAL" if updated else "UNAVAILABLE"),
            "updated_assets": updated,
            "unresolved_assets": unresolved,
            "updated_at": now_iso(),
        }
        await self.state.emit("sync.metadata", result)
        return self._remember("metadata", result)

    async def sync_risk(self) -> dict[str, Any]:
        providers = self.provider_registry()
        updated = 0
        unresolved = 0
        assets = self.state.vault.data().get("assets", {})

        for mint, asset in assets.items():
            if mint == "SOL":
                continue
            report = await providers.token_risk(mint)
            if report is None:
                unresolved += 1
                continue
            asset["risk_report"] = report
            if report.get("score_normalised") is not None:
                asset["rugcheck_score_normalised"] = report["score_normalised"]
            asset["risk_updated_at"] = now_iso()
            updated += 1

        self.state.vault.save()
        result = {
            "status": "SYNCED" if unresolved == 0 else ("PARTIAL" if updated else "UNAVAILABLE"),
            "updated_assets": updated,
            "unresolved_assets": unresolved,
            "updated_at": now_iso(),
        }
        await self.state.emit("sync.risk", result)
        return self._remember("risk", result)