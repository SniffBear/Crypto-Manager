from __future__ import annotations
import secrets
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from .deps import require_session

router = APIRouter(prefix="/accounting", tags=["accounting"])
class Entry(BaseModel):
    type: str
    description: str
    amount_usd: float = 0.0
    wallet_id: str | None = None
    asset_mint: str | None = None

@router.get("")
async def list_entries(state=Depends(require_session)):
    return list(reversed(state.vault.data().setdefault("accounting", [])))

@router.post("")
async def add_entry(body: Entry, state=Depends(require_session)):
    item = {"id": secrets.token_hex(8), **body.model_dump()}
    state.vault.data().setdefault("accounting", []).append(item)
    state.vault.save()
    return item