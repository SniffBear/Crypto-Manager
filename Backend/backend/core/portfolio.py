from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .assets import AssetService
from .state import AppState


class PortfolioService:
    def __init__(self, state: AppState) -> None:
        self.state = state

    def summary(self) -> dict[str, Any]:
        AssetService(self.state).migrate()
        assets = self.state.vault.data().setdefault("assets", {})
        wallets: dict[str, float] = {}
        total = 0.0
        unallocated = 0.0

        for asset in assets.values():
            holdings = asset.get("holdings", {})
            has_holding_value = False
            for wallet_id, holding in holdings.items():
                value = holding.get("value_usd")
                if not isinstance(value, (int, float)):
                    continue
                has_holding_value = True
                total += float(value)
                wallets[wallet_id] = wallets.get(wallet_id, 0.0) + float(value)

            if not has_holding_value:
                legacy_value = asset.get("unallocated_value_usd")
                if isinstance(legacy_value, (int, float)):
                    total += float(legacy_value)
                    unallocated += float(legacy_value)

        return {
            "total_value_usd": round(total, 8),
            "asset_count": len(assets),
            "wallet_count": len(self.state.vault.data().get("wallets", [])),
            "wallet_values_usd": {key: round(value, 8) for key, value in wallets.items()},
            "unallocated_value_usd": round(unallocated, 8),
        }

    def snapshot(self) -> dict[str, Any]:
        item = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **self.summary(),
        }
        self.state.vault.data().setdefault("portfolio_snapshots", []).append(item)
        self.state.vault.save()
        return item

    def history(self, limit: int = 100) -> list[dict[str, Any]]:
        snapshots = self.state.vault.data().get("portfolio_snapshots", [])
        return list(reversed(snapshots[-max(1, min(limit, 1000)):]))