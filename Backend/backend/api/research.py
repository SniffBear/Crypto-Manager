from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from .deps import require_session

router = APIRouter(prefix="/research", tags=["research"])

@router.get("/search")
async def search(q: str = Query(min_length=1), state=Depends(require_session)):
    assets = list(state.vault.data().get("assets", {}).values())
    ql = q.lower()
    return [a for a in assets if ql in str(a.get("symbol", "")).lower() or ql in str(a.get("name", "")).lower() or ql in str(a.get("mint", "")).lower()]