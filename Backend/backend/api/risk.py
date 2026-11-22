from __future__ import annotations
from fastapi import APIRouter, Depends
from .deps import require_session

router = APIRouter(prefix="/risk", tags=["risk"])

@router.get("/overview")
async def overview(state=Depends(require_session)):
    assets = list(state.vault.data().get("assets", {}).values())
    buckets = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    for a in assets:
        level = str(a.get("risk", "unknown")).lower()
        buckets[level if level in buckets else "unknown"] += 1
    return {"asset_risk_buckets": buckets, "asset_count": len(assets)}