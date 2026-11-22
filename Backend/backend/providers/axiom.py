from __future__ import annotations

from .base import HttpProvider


class AxiomProvider(HttpProvider):
    name = "axiom"
    default_base_url = "https://axiom.trade"
    capabilities = {
        "market_data",
        "traders",
        "official_api_unavailable",
    }
    requires_api_key = False

    async def health(self) -> dict:
        # Axiom Trade does not currently publish an official public trading/data
        # API. Do not reverse-engineer browser session endpoints or treat an
        # account cookie as a developer credential.
        return {
            "provider": self.name,
            "status": "UNAVAILABLE_OFFICIAL_API",
            "configured": False,
            "detail": "No official public Axiom Trade developer API is documented.",
        }