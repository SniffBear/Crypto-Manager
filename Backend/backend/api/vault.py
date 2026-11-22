from __future__ import annotations
from fastapi import APIRouter, Depends
from .deps import require_session

router = APIRouter(prefix="/vault", tags=["vault"])

@router.get("")
async def info(state=Depends(require_session)):
    return state.vault.metadata()

@router.post("/save")
async def save(state=Depends(require_session)):
    state.vault.save()
    return {"saved": True}