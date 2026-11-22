from __future__ import annotations

from typing import Any

from .adapters import AdapterError, make_adapter
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
        return {
            "network_id": network_id,
            "provider_kind": network.provider_kind,
            "configured": bool(base_url),
            "base_url": base_url,
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
            result = {
                "network_id": network_id,
                "chain": "solana",
                "status": "SYNCED" if wallet_result.get("status") == "SYNCED" and activity_result.get("status") == "SYNCED" else "PARTIAL",
                "source": "EXISTING_SOLANA_SYNC",
                "wallet_id": wallet_id,
                "wallet_sync": wallet_result,
                "activity_sync": activity_result,
                "synced_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
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
                "checked_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            }
        adapter = make_adapter(network, self.provider_config(network_id))
        return await adapter.health()
