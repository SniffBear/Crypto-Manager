from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from .deps import require_session
from ..core.portfolio import PortfolioService

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/summary")
async def summary(state=Depends(require_session)):
    return PortfolioService(state).summary()


@router.get("/history")
async def history(
    limit: int = Query(default=100, ge=1, le=1000),
    state=Depends(require_session),
):
    return PortfolioService(state).history(limit)


@router.post("/snapshots")
async def snapshot(state=Depends(require_session)):
    return PortfolioService(state).snapshot()