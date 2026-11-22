from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from .deps import require_session
from ..core.assets import AssetService

router = APIRouter(prefix="/assets", tags=["assets"])

@router.get("")
async def list_assets(wallet_id: str | None = None, search: str | None = None, state=Depends(require_session)):
    return AssetService(state).list(wallet_id=wallet_id, search=search)

@router.get("/{mint}")
async def get_asset(mint: str, state=Depends(require_session)):
    try:
        return AssetService(state).get(mint)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))