from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .state import AppState


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AssetService:
    def __init__(self, state: AppState) -> None:
        self.state = state

    def _ensure_holding_schema(self, asset: dict[str, Any]) -> bool:
        changed = False
        if "holdings" in asset:
            return False

        wallet_ids = [str(x) for x in asset.get("wallet_ids", []) if x]
        value_usd = asset.get("value_usd")
        holdings: dict[str, dict[str, Any]] = {}

        # Only migrate a legacy aggregate value to a specific wallet when the
        # old record identified exactly one wallet. Multi-wallet aggregates
        # remain explicitly unallocated instead of being duplicated.
        if len(wallet_ids) == 1:
            wallet_id = wallet_ids[0]
            holdings[wallet_id] = {
                "wallet_id": wallet_id,
                "amount": asset.get("amount"),
                "value_usd": float(value_usd) if isinstance(value_usd, (int, float)) else None,
                "price_usd": asset.get("price_usd"),
                "decimals": asset.get("decimals"),
                "token_account": asset.get("token_account"),
                "source": "legacy_aggregate",
                "updated_at": asset.get("updated_at") or now_iso(),
                "slot": asset.get("slot"),
            }
        elif wallet_ids and isinstance(value_usd, (int, float)):
            asset["unallocated_value_usd"] = float(value_usd)
            changed = True

        asset["holdings"] = holdings
        asset["wallet_ids"] = wallet_ids
        changed = True
        return changed

    def migrate(self) -> int:
        assets = self.state.vault.data().setdefault("assets", {})
        changed_count = 0
        changed = False
        for asset in assets.values():
            if isinstance(asset, dict) and self._ensure_holding_schema(asset):
                changed_count += 1
                changed = True
        if changed:
            self.state.vault.save()
        return changed_count

    def list(
        self,
        wallet_id: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        self.migrate()
        assets = list(self.state.vault.data().get("assets", {}).values())
        if wallet_id:
            assets = [
                asset
                for asset in assets
                if wallet_id in asset.get("holdings", {})
            ]
        if search:
            q = search.lower()
            assets = [
                asset
                for asset in assets
                if q in (asset.get("symbol") or "").lower()
                or q in (asset.get("mint") or "").lower()
                or q in (asset.get("name") or "").lower()
            ]
        return assets

    def upsert(self, asset: dict[str, Any]) -> dict[str, Any]:
        mint = asset["mint"]
        asset = dict(asset)
        self._ensure_holding_schema(asset)
        self.state.vault.data().setdefault("assets", {})[mint] = asset
        self.state.vault.save()
        return asset

    def upsert_holding(
        self,
        *,
        wallet_id: str,
        mint: str,
        amount: float,
        decimals: int | None,
        token_account: str | None,
        program: str,
        price_usd: float | None = None,
        value_usd: float | None = None,
        symbol: str | None = None,
        name: str | None = None,
        slot: int | None = None,
        source: str = "solana_rpc",
    ) -> dict[str, Any]:
        assets = self.state.vault.data().setdefault("assets", {})
        asset = assets.get(mint) or {
            "mint": mint,
            "holdings": {},
            "wallet_ids": [],
        }
        self._ensure_holding_schema(asset)

        holding = {
            "wallet_id": wallet_id,
            "amount": amount,
            "value_usd": value_usd if value_usd is not None else (
                amount * price_usd if price_usd is not None else None
            ),
            "price_usd": price_usd,
            "decimals": decimals,
            "token_account": token_account,
            "source": source,
            "updated_at": now_iso(),
            "slot": slot,
        }
        asset["holdings"][wallet_id] = holding
        asset["wallet_ids"] = sorted(set(asset.get("wallet_ids", [])) | {wallet_id})
        if symbol is not None:
            asset["symbol"] = symbol
        if name is not None:
            asset["name"] = name
        asset["decimals"] = decimals
        asset["program"] = program
        asset["updated_at"] = holding["updated_at"]
        assets[mint] = asset
        return asset

    def remove_wallet_holding(self, *, wallet_id: str, mint: str) -> None:
        asset = self.state.vault.data().setdefault("assets", {}).get(mint)
        if not asset:
            return
        holdings = asset.setdefault("holdings", {})
        holdings.pop(wallet_id, None)
        asset["wallet_ids"] = sorted(holdings.keys())
        asset["updated_at"] = now_iso()

    def get(self, mint: str) -> dict[str, Any]:
        self.migrate()
        asset = self.state.vault.data().setdefault("assets", {}).get(mint)
        if not asset:
            raise KeyError("Asset not found")
        return asset