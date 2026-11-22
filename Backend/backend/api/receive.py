from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from .deps import require_session

router = APIRouter(prefix="/receive", tags=["receive"])

@router.get("/{wallet_id}")
async def receive_info(wallet_id: str, state=Depends(require_session)):
    for w in state.vault.data().get("wallets", []):
        if w["id"] == wallet_id:
            return {"wallet_id": wallet_id, "address": w["address"], "label": w["label"], "watch_only": w["watch_only"]}
    raise HTTPException(status_code=404, detail="Wallet not found")