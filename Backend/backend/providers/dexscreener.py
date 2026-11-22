from __future__ import annotations

from .base import HttpProvider


class DexScreenerProvider(HttpProvider):
    name = "dexscreener"
    default_base_url = "https://api.dexscreener.com"
    requires_api_key = False
    health_path = "/latest/dex/tokens/So11111111111111111111111111111111111111112"
    capabilities = {"pairs", "tokens", "market_data"}

    async def token_price(self, mint: str) -> float | None:
        try:
            _, payload = await self.request_json(
                "GET",
                f"/latest/dex/tokens/{mint}",
            )
            pairs = payload.get("pairs", []) if isinstance(payload, dict) else []
            candidates = [
                pair
                for pair in pairs
                if isinstance(pair, dict) and pair.get("chainId") == "solana"
            ]
            candidates.sort(
                key=lambda pair: float((pair.get("liquidity") or {}).get("usd") or 0),
                reverse=True,
            )
            for pair in candidates:
                raw = pair.get("priceUsd")
                try:
                    if raw is not None:
                        return float(raw)
                except (TypeError, ValueError):
                    continue
        except Exception:
            return None
        return None