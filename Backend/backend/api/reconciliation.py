from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from .deps import require_session
from ..sync.reconciliation import PortfolioReconciliationService

router = APIRouter(prefix="/portfolio/reconciliation", tags=["portfolio-reconciliation"])


@router.get("")
async def latest_reconciliation(state=Depends(require_session)):
    return PortfolioReconciliationService(state).latest()


@router.get("/history")
async def reconciliation_history(limit: int = Query(default=100, ge=1, le=500), state=Depends(require_session)):
    return PortfolioReconciliationService(state).history(limit)


@router.post("/run")
async def run_reconciliation(state=Depends(require_session)):
    try:
        return await PortfolioReconciliationService(state).reconcile()
    except RuntimeError as exc:
        raise HTTPException(status_code=423, detail=str(exc))