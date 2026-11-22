from __future__ import annotations

from .base import HttpProvider


class RugCheckProvider(HttpProvider):
    name = "rugcheck"
    default_base_url = "https://api.rugcheck.xyz"
    requires_api_key = False
    health_path = "/v1/stats/new_tokens"
    capabilities = {"token_risk", "holders", "markets"}

    async def token_risk(self, mint: str) -> dict | None:
        try:
            _, payload = await self.request_json(
                "GET",
                f"/v1/tokens/{mint}/report/summary",
            )
            return payload if isinstance(payload, dict) else None
        except Exception:
            return None