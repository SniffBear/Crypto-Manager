from __future__ import annotations

from typing import Any

from .base import HttpProvider


class JupiterProvider(HttpProvider):
    name = "jupiter"
    default_base_url = "https://api.jup.ag/swap/v1"
    capabilities = {"quotes", "swap", "tokens", "transaction_builder"}
    requires_api_key = True

    def _headers(self) -> dict[str, str]:
        headers = super()._headers()
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    async def quote(
        self,
        *,
        input_mint: str,
        output_mint: str,
        amount: int,
        slippage_bps: int = 50,
    ) -> dict[str, Any]:
        _, payload = await self.request_json(
            "GET",
            "/quote",
            params={
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": amount,
                "slippageBps": slippage_bps,
                "instructionVersion": "V2",
            },
        )
        if not isinstance(payload, dict):
            raise RuntimeError("Invalid Jupiter quote response")
        return payload

    async def build_swap(
        self,
        *,
        user_public_key: str,
        quote_response: dict[str, Any],
        prioritization_fee_lamports: int | None = None,
    ) -> dict[str, Any]:
        priority = (
            prioritization_fee_lamports
            if prioritization_fee_lamports is not None
            else {
                "priorityLevelWithMaxLamports": {
                    "priorityLevel": "veryHigh",
                    "maxLamports": 1_000_000,
                }
            }
        )
        _, payload = await self.request_json(
            "POST",
            "/swap",
            json={
                "userPublicKey": user_public_key,
                "quoteResponse": quote_response,
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": priority,
            },
        )
        if not isinstance(payload, dict) or not payload.get("swapTransaction"):
            raise RuntimeError("Jupiter did not return a swap transaction")
        return payload

    async def token_price(self, mint: str) -> float | None:
        return None