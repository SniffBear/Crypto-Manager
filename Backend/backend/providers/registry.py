from __future__ import annotations

from typing import Any, Type

from .axiom import AxiomProvider
from .bitquery import BitqueryProvider
from .birdeye import BirdeyeProvider
from .dexscreener import DexScreenerProvider
from .gmgn import GMGNProvider
from .helius import HeliusProvider
from .jupiter import JupiterProvider
from .rugcheck import RugCheckProvider

PROVIDER_TYPES: dict[str, Type] = {
    "helius": HeliusProvider,
    "gmgn": GMGNProvider,
    "dexscreener": DexScreenerProvider,
    "birdeye": BirdeyeProvider,
    "jupiter": JupiterProvider,
    "rugcheck": RugCheckProvider,
    "axiom": AxiomProvider,
    "bitquery": BitqueryProvider,
}


class ProviderRegistry:
    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self._providers: dict[str, Any] = {}
        self.load(config or {})

    def load(self, config: dict[str, Any]) -> None:
        self._providers.clear()
        for name, cls in PROVIDER_TYPES.items():
            item = config.get(name, {}) if isinstance(config, dict) else {}
            self._providers[name] = cls(
                api_key=item.get("api_key"),
                base_url=item.get("base_url"),
            )

    def configure(
        self,
        name: str,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        if name not in PROVIDER_TYPES:
            raise KeyError("Unknown provider")
        self._providers[name] = PROVIDER_TYPES[name](
            api_key=api_key,
            base_url=base_url,
        )

    def get(self, name: str):
        return self._providers[name]

    async def health(self) -> list[dict[str, Any]]:
        return [await provider.health() for provider in self._providers.values()]

    async def token_price(self, mint: str) -> float | None:
        for name in ("birdeye", "dexscreener"):
            provider = self._providers.get(name)
            if not provider or not provider.configured():
                continue
            price = await provider.token_price(mint)
            if price is not None and price >= 0:
                return price
        return None

    async def token_risk(self, mint: str) -> dict[str, Any] | None:
        provider = self._providers.get("rugcheck")
        if provider and provider.configured():
            return await provider.token_risk(mint)
        return None

    async def token_metadata(self, mint: str) -> dict[str, Any] | None:
        provider = self._providers.get("helius")
        if provider and provider.configured():
            try:
                asset = await provider.get_asset(mint)
                if asset:
                    metadata = asset.get("content", {}).get("metadata", {})
                    token_info = asset.get("token_info", {})
                    return {
                        "symbol": metadata.get("symbol"),
                        "name": metadata.get("name"),
                        "uri": asset.get("content", {}).get("json_uri"),
                        "image_url": (
                            asset.get("content", {}).get("links", {}).get("image")
                            or metadata.get("image")
                        ),
                        "decimals": token_info.get("decimals"),
                        "supply": token_info.get("supply"),
                        "price_usd": token_info.get("price_info", {}).get("price_per_token"),
                        "interface": asset.get("interface"),
                        "authorities": asset.get("authorities"),
                        "ownership": asset.get("ownership"),
                        "raw": asset,
                    }
            except Exception:
                pass
        return None

    def summary(self) -> list[dict[str, Any]]:
        return [
            {
                "name": name,
                "configured": provider.configured(),
                "base_url": provider.base_url,
                "capabilities": sorted(provider.capabilities),
            }
            for name, provider in self._providers.items()
        ]