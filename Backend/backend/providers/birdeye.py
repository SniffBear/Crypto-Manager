from __future__ import annotations

from .base import HttpProvider


class BirdeyeProvider(HttpProvider):
    name = "birdeye"
    default_base_url = "https://public-api.birdeye.so"
    health_path = "/defi/price"
    health_params = {"address": "So11111111111111111111111111111111111111112"}
    capabilities = {"tokens", "balances", "market_data", "historical_prices"}

    def _headers(self) -> dict[str, str]:
        headers = super()._headers()
        if self.api_key:
            headers["X-API-KEY"] = self.api_key
        headers["x-chain"] = "solana"
        return headers

    async def token_price(self, mint: str) -> float | None:
        try:
            _, payload = await self.request_json(
                "GET",
                "/defi/price",
                params={"address": mint},
                headers={"x-chain": "solana"},
            )
            if isinstance(payload, dict):
                value = payload.get("data", {}).get("value")
                if value is not None:
                    return float(value)
        except Exception:
            return None
        return None