from __future__ import annotations
import secrets
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from .deps import require_session

router = APIRouter(prefix="/watchlists", tags=["watchlists"])
class Watchlist(BaseModel):
    name: str
    assets: list[str] = Field(default_factory=list)

@router.get("")
async def list_watchlists(state=Depends(require_session)):
    return state.vault.data().setdefault("watchlists", [])

@router.post("")
async def create_watchlist(body: Watchlist, state=Depends(require_session)):
    item = {"id": secrets.token_hex(8), **body.model_dump()}
    state.vault.data().setdefault("watchlists", []).append(item)
    state.vault.save()
    return item