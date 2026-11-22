from __future__ import annotations

from typing import Any

import httpx

from .base import HttpProvider


class HeliusProvider(HttpProvider):
    name = "helius"
    default_base_url = "https://mainnet.helius-rpc.com"
    capabilities = {
        "balances",
        "transactions",
        "assets",
        "metadata",
        "parsed_events",
        "transfers",
        "rpc",
        "webhooks",
    }

    requires_api_key = True

    def _request_url(self, path: str = "") -> str:
        base = self.base_url.rstrip("/")
        return f"{base}/{path.lstrip('/')}" if path else base

    async def _rpc(self, method: str, params: Any) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/?api-key={self.api_key}",
                json={"jsonrpc": "2.0", "id": "solana-vault", "method": method, "params": params},
                headers={"content-type": "application/json", "accept": "application/json"},
            )
        response.raise_for_status()
        payload = response.json()
        if payload.get("error"):
            raise RuntimeError("Helius RPC request failed")
        return payload.get("result") or {}

    async def get_asset(self, mint: str) -> dict[str, Any] | None:
        result = await self._rpc(
            "getAsset",
            {
                "id": mint,
                "displayOptions": {
                    "showFungible": True,
                    "showInscription": False,
                },
            },
        )
        return result or None

    async def get_assets_by_owner(
        self,
        owner_address: str,
        *,
        page: int = 1,
        limit: int = 1000,
    ) -> dict[str, Any]:
        return await self._rpc(
            "getAssetsByOwner",
            {
                "ownerAddress": owner_address,
                "page": max(1, page),
                "limit": min(1000, max(1, limit)),
                "displayOptions": {
                    "showFungible": True,
                    "showNativeBalance": True,
                    "showZeroBalance": False,
                },
            },
        )

    async def parse_transactions(self, signatures: list[str]) -> list[dict[str, Any]]:
        signatures = [str(item) for item in signatures if item]
        if not signatures:
            return []
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/v1/parsed-events/transactions?api-key={self.api_key}",
                json={"transactions": signatures[:100]},
                headers={"content-type": "application/json", "accept": "application/json"},
            )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, list) else payload.get("transactions", [])

    async def get_transfers_by_address(
        self,
        address: str,
        *,
        limit: int = 100,
        before: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"api-key": self.api_key, "limit": min(limit, 100)}
        if before:
            params["before"] = before
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/v1/addresses/{address}/transfers",
                params=params,
                headers={"accept": "application/json"},
            )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, list) else payload.get("transfers", [])

    async def token_price(self, mint: str) -> float | None:
        asset = await self.get_asset(mint)
        try:
            return float(
                asset.get("token_info", {})
                .get("price_info", {})
                .get("price_per_token")
            )
        except (TypeError, ValueError, AttributeError):
            return None

    async def health(self) -> dict[str, Any]:
        if not self.api_key:
            return {
                "provider": self.name,
                "status": "UNCONFIGURED",
                "configured": False,
                "latency_ms": None,
            }
        try:
            await self._rpc(
                "getAsset",
                {
                    "id": "So11111111111111111111111111111111111111112",
                    "displayOptions": {"showFungible": True},
                },
            )
            return {
                "provider": self.name,
                "status": "OK",
                "configured": True,
            }
        except httpx.TimeoutException:
            return {"provider": self.name, "status": "TIMEOUT", "configured": True}
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            return {
                "provider": self.name,
                "status": "RATE_LIMITED" if code == 429 else (
                    "UNAUTHORIZED" if code in {401, 403} else "DEGRADED"
                ),
                "configured": True,
                "http_status": code,
            }
        except Exception as exc:
            return {
                "provider": self.name,
                "status": "ERROR",
                "configured": True,
                "error": type(exc).__name__,
            }