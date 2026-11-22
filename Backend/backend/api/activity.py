from __future__ import annotations
from fastapi import APIRouter, Depends
from .deps import require_session

router = APIRouter(prefix="/activity", tags=["activity"])

@router.get("")
async def list_activity(limit: int = 100, state=Depends(require_session)):
    return list(reversed(state.vault.data().get("activity", [])))[:max(1, min(limit, 500))]