from __future__ import annotations

from enum import Enum

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .deps import require_session
from ..sync.service import SyncService

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncKind(str, Enum):
    wallets = "wallets"
    activity = "activity"
    prices = "prices"
    risk = "risk"
    metadata = "metadata"


class SyncRequest(BaseModel):
    kind: SyncKind


def status(state):
    return state.services.setdefault("sync_status", {})


@router.get("/status")
async def sync_status(state=Depends(require_session)):
    return status(state)


@router.post("/run")
async def run_sync(body: SyncRequest, state=Depends(require_session)):
    service = SyncService(state)
    if body.kind == SyncKind.wallets:
        result = await service.sync_wallets()
    elif body.kind == SyncKind.activity:
        result = await service.sync_activity()
    elif body.kind == SyncKind.prices:
        result = await service.sync_prices()
    elif body.kind == SyncKind.metadata:
        result = await service.sync_metadata()
    else:
        result = await service.sync_risk()

    status(state)[body.kind.value] = result
    return result