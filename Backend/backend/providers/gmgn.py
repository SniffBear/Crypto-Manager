from __future__ import annotations

import base64
from typing import Any

import httpx

from .base import HttpProvider


class GMGNProvider(HttpProvider):
    name = "gmgn"
    default_base_url = "https://gmgn.ai"
    capabilities = {"approved_trading_api", "swap", "transaction_status"}

    requires_api_key = True

    def _headers(self) -> dict[str, str]:
        headers = super()._headers()
        if self.api_key:
            headers["x-route-key"] = self.api_key
        return headers

    async def get_swap_route(
        self,
        *,
        token_in_address: str,
        token_out_address: str,
        in_amount: str,
        from_address: str,
        slippage: float,
    ) -> dict[str, Any]:
        _, payload = await self.request_json(
            "GET",
            "/defi/router/v1/sol/tx/get_swap_route",
            params={
                "token_in_address": token_in_address,
                "token_out_address": token_out_address,
                "in_amount": in_amount,
                "from_address": from_address,
                "slippage": slippage,
            },
        )
        if not isinstance(payload, dict):
            raise RuntimeError("Invalid GMGN route response")
        return payload

    async def submit_signed_transaction(
        self,
        signed_tx_base64: str,
        *,
        anti_mev: bool = False,
    ) -> dict[str, Any]:
        _, payload = await self.request_json(
            "POST",
            "/defi/router/v1/sol/tx/send_transaction",
            json={
                "chain": "sol",
                "signedTx": signed_tx_base64,
                "isAntiMev": anti_mev,
            },
        )
        return payload if isinstance(payload, dict) else {"data": payload}

    async def transaction_status(
        self,
        signature: str,
        last_valid_height: int,
    ) -> dict[str, Any]:
        _, payload = await self.request_json(
            "GET",
            "/defi/router/v1/sol/tx/get_transaction_status",
            params={
                "hash": signature,
                "last_valid_height": last_valid_height,
            },
        )
        return payload if isinstance(payload, dict) else {"data": payload}

    async def health(self) -> dict[str, Any]:
        if not self.api_key:
            return {
                "provider": self.name,
                "status": "UNCONFIGURED",
                "configured": False,
                "detail": "GMGN trading API access requires an approved x-route-key.",
            }
        return {
            "provider": self.name,
            "status": "UNVERIFIED",
            "configured": True,
            "detail": "GMGN does not expose a harmless authenticated health request; use quote/route requests to verify trading access.",
        }