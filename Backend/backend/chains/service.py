from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlparse
from typing import Any

from .adapters import make_adapter
from .registry import get_network, list_networks, network_id_for
from .addresses import validate_address


class ChainService:
    def __init__(self, state) -> None:
        self.state = state

    def networks(self) -> list[dict[str, Any]]:
        return list_networks()

    def provider_config(self, network_id: str) -> dict[str, Any]:
        get_network(network_id)
        return self.state.vault.data().get("chain_providers", {}).get(network_id, {})

    def provider_summary(self, network_id: str) -> dict[str, Any]:
        network = get_network(network_id)
        config = self.provider_config(network_id)
        base_url = config.get("base_url") or network.default_endpoint
        parsed = urlparse(base_url) if base_url else None
        return {
            "network_id": network_id,
            "provider_kind": network.provider_kind,
            "configured": bool(base_url),
            # Never return a full endpoint: vendors sometimes place API
            # credentials in URL paths even when query strings are absent.
            "provider_host": parsed.hostname if parsed else None,
            "provider_port": parsed.port if parsed else None,
            "has_api_key": bool(config.get("api_key")),
            "has_basic_auth": bool(config.get("username")),
            "wallet_rpc_address_configured": bool(config.get("wallet_address")),
        }

    def validate(self, network_id: str, address: str) -> dict[str, Any]:
        network = get_network(network_id)
        return validate_address(network, address).as_dict()

    async def sync_wallet(self, wallet_id: str, network_id: str) -> dict[str, Any]:
        network = get_network(network_id)
        wallet = next(
            (item for item in self.state.vault.data().get("wallets", []) if item.get("id") == wallet_id),
            None,
        )
        if not wallet:
            raise KeyError("Wallet not found")

        wallet_chain = wallet.get("chain") or "solana"
        wallet_network = wallet.get("network") or "mainnet-beta"
        wallet_network_id = wallet.get("network_id") or network_id_for(wallet_chain, wallet_network)
        if wallet_network_id != network_id:
            raise ValueError("Wallet belongs to a different network")

        validation = validate_address(network, str(wallet.get("address") or ""))
        if not validation.valid:
            raise ValueError(validation.reason or "Wallet address is invalid for this network")

        if network.family == "solana":
            # Preserve and reuse the mature Solana synchronizer. It processes
            # the configured Solana wallet set only; non-Solana wallets are
            # explicitly filtered from SyncService.
            from ..sync.service import SyncService

            sync = SyncService(self.state)
            wallet_result = await sync.sync_wallets()
            activity_result = await sync.sync_activity()
            token_balances = []
            native_balance = None
            for asset_id, asset in self.state.vault.data().get("assets", {}).items():
                holding = asset.get("holdings", {}).get(wallet_id)
                if not holding:
                    continue
                item = {
                    "asset_id": asset_id,
                    "symbol": asset.get("symbol") or ("SOL" if asset_id == "SOL" else None),
                    "balance": str(holding.get("amount")),
                    "decimals": holding.get("decimals", asset.get("decimals")),
                    "source": holding.get("source", "solana_rpc"),
                }
                if asset_id == "SOL":
                    native_balance = item
                else:
                    token_balances.append(item)
            result = {
                "network_id": network_id,
                "chain": "solana",
                "status": "SYNCED" if wallet_result.get("status") == "SYNCED" and activity_result.get("status") == "SYNCED" else "PARTIAL",
                "source": "EXISTING_SOLANA_SYNC",
                "wallet_id": wallet_id,
                "native_asset": "SOL",
                "balance": native_balance.get("balance") if native_balance else None,
                "balance_raw": None,
                "decimals": 9,
                "native_balance": native_balance,
                "token_balances": token_balances,
                "wallet_sync": wallet_result,
                "activity_sync": activity_result,
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            config = self.provider_config(network_id)
            adapter = make_adapter(network, config)
            result = await adapter.sync_wallet(wallet)
        wallet["chain_sync"] = result
        wallet["chain_sync_status"] = result.get("status", "UNKNOWN")
        self.state.vault.save()
        await self.state.emit("chain.wallet_synced", {
            "wallet_id": wallet_id,
            "network_id": network_id,
            "status": result.get("status"),
            "synced_at": result.get("synced_at"),
        })
        return result

    def portfolio_summary(self) -> dict[str, Any]:
        wallets = self.state.vault.data().get("wallets", [])
        rows: list[dict[str, Any]] = []
        totals: dict[str, dict[str, Any]] = {}
        for wallet in wallets:
            sync = wallet.get("chain_sync")
            if not isinstance(sync, dict):
                continue
            network_id = wallet.get("network_id") or network_id_for(
                wallet.get("chain") or "solana",
                wallet.get("network") or "mainnet-beta",
            )
            native = sync.get("native_balance") if isinstance(sync.get("native_balance"), dict) else {
                "symbol": sync.get("native_asset"),
                "balance": sync.get("balance"),
                "decimals": sync.get("decimals"),
            }
            assets = []
            if native.get("balance") is not None:
                assets.append(native)
            assets.extend(sync.get("token_balances") or [])
            for asset in assets:
                symbol = str(asset.get("symbol") or asset.get("asset_id") or "UNKNOWN")
                amount = asset.get("balance")
                if amount is None:
                    continue
                key = f"{network_id}:{asset.get('asset_id') or symbol}"
                entry = totals.setdefault(key, {
                    "network_id": network_id,
                    "asset_id": asset.get("asset_id") or symbol,
                    "symbol": symbol,
                    "balance": "0",
                    "wallet_count": 0,
                    "value_usd": None,
                })
                entry["balance"] = format(Decimal(str(entry["balance"])) + Decimal(str(amount)), "f")
                entry["wallet_count"] += 1
            rows.append({
                "wallet_id": wallet.get("id"),
                "label": wallet.get("label"),
                "address": wallet.get("address"),
                "network_id": network_id,
                "chain": wallet.get("chain") or "solana",
                "network": wallet.get("network") or "mainnet-beta",
                "status": sync.get("status", "UNKNOWN"),
                "native_asset": sync.get("native_asset"),
                "balance": sync.get("balance"),
                "decimals": sync.get("decimals"),
                "synced_at": sync.get("synced_at"),
                "value_usd": None,
            })
        return {
            "status": "PARTIAL" if any(row["status"] != "SYNCED" for row in rows) else ("SYNCED" if rows else "NOT_SYNCED"),
            "wallet_count": len(rows),
            "value_usd": None,
            "value_status": "UNAVAILABLE_UNTIL_CHAIN_PRICE_ADAPTERS_ARE_CONFIGURED",
            "wallets": rows,
            "asset_totals": list(totals.values()),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    async def provider_health(self, network_id: str) -> dict[str, Any]:
        network = get_network(network_id)
        if network.family == "solana":
            from ..sync.service import SyncService

            pool = SyncService(self.state).rpc_pool()
            await pool.probe_all()
            endpoints = pool.list()
            healthy = [item for item in endpoints if item.get("network") == network.network and item.get("status") == "OK"]
            return {
                "network_id": network_id,
                "status": "OK" if healthy else "UNAVAILABLE",
                "configured": bool(endpoints),
                "healthy_endpoints": len(healthy),
                "endpoint_count": len(endpoints),
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
        adapter = make_adapter(network, self.provider_config(network_id))
        return await adapter.health()
