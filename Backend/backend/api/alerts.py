from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .deps import require_session
from ..core.alerts import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])


class CreateAlert(BaseModel):
    level: str = "info"
    title: str
    message: str
    wallet_id: str | None = None
    kind: str = "system"


class AlertRule(BaseModel):
    enabled: bool = True
    source: str = "portfolio"
    field: str
    operator: str = "gt"
    threshold: float
    wallet_id: str | None = None
    mint: str | None = None
    level: str = "warning"
    title: str = "Alert rule triggered"
    message: str = "Configured alert condition matched."
    cooldown_seconds: int = Field(default=300, ge=0, le=86400)


@router.get("")
async def list_alerts(unread_only: bool = False, state=Depends(require_session)):
    return AlertService(state).list(unread_only=unread_only)


@router.post("")
async def create_alert(body: CreateAlert, state=Depends(require_session)):
    return await AlertService(state).create(**body.model_dump())


@router.get("/rules")
async def list_rules(state=Depends(require_session)):
    return AlertService(state).list_rules()


@router.post("/rules")
async def create_rule(body: AlertRule, state=Depends(require_session)):
    try:
        return AlertService(state).create_rule(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, state=Depends(require_session)):
    try:
        AlertService(state).delete_rule(rule_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"deleted": True}


@router.post("/evaluate")
async def evaluate_rules(state=Depends(require_session)):
    return await AlertService(state).evaluate()


@router.post("/{alert_id}/read")
async def mark_read(alert_id: str, state=Depends(require_session)):
    try:
        AlertService(state).mark_read(alert_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"read": True}