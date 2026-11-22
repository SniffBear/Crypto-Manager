from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .deps import require_session
from ..core.alerts import OPERATORS
from ..core.signers import live_execution_enabled

router = APIRouter(prefix="/strategies", tags=["strategies"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Strategy(BaseModel):
    name: str
    enabled: bool = False
    interval_seconds: int = Field(default=60, ge=10, le=86400)
    rules: list[dict[str, Any]] = Field(default_factory=list)
    actions: list[dict[str, Any]] = Field(default_factory=list)


@router.get("")
async def list_strategies(state=Depends(require_session)):
    return state.vault.data().setdefault("strategies", [])


@router.post("")
async def create_strategy(body: Strategy, state=Depends(require_session)):
    for rule in body.rules:
        if str(rule.get("operator", "gt")) not in OPERATORS:
            raise HTTPException(status_code=400, detail="Unsupported strategy rule operator")
        if not rule.get("field"):
            raise HTTPException(status_code=400, detail="Every strategy rule requires a field")
    item = {
        "id": secrets.token_hex(8),
        **body.model_dump(),
        "last_run_at": None,
        "last_run_status": None,
    }
    state.vault.data().setdefault("strategies", []).append(item)
    state.vault.data().setdefault("strategy_runs", [])
    state.vault.save()
    return item


@router.post("/{strategy_id}/run")
async def run_strategy(strategy_id: str, state=Depends(require_session)):
    strategy = next(
        (s for s in state.vault.data().get("strategies", []) if s.get("id") == strategy_id),
        None,
    )
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    candidates = _strategy_candidates(state)
    matched = all(_matches(rule, candidates, strategy) for rule in strategy.get("rules", []))
    run = {
        "id": secrets.token_hex(8),
        "strategy_id": strategy_id,
        "started_at": now_iso(),
        "finished_at": now_iso(),
        "matched": matched,
        "mode": "live" if live_execution_enabled() else "paper",
        "actions": [],
        "status": "MATCHED" if matched else "NO_MATCH",
    }

    if matched:
        for action in strategy.get("actions", []):
            result = await _execute_action(state, action, strategy)
            run["actions"].append(result)

    strategy["last_run_at"] = run["finished_at"]
    strategy["last_run_status"] = run["status"]
    state.vault.data().setdefault("strategy_runs", []).append(run)
    state.vault.save()
    await state.emit("strategy.run", run)
    return run


@router.get("/{strategy_id}/runs")
async def strategy_runs(strategy_id: str, state=Depends(require_session)):
    runs = [
        r for r in state.vault.data().get("strategy_runs", [])
        if r.get("strategy_id") == strategy_id
    ]
    return list(reversed(runs))[:500]


async def _execute_action(state, action: dict[str, Any], strategy: dict[str, Any]) -> dict[str, Any]:
    action_type = str(action.get("type", "alert"))
    if action_type == "alert":
        from ..core.alerts import AlertService

        alert = await AlertService(state).create(
            level=str(action.get("level", "info")),
            title=str(action.get("title") or f"Strategy: {strategy['name']}"),
            message=str(action.get("message") or "Strategy condition matched."),
            wallet_id=action.get("wallet_id"),
            kind=f"strategy:{strategy['id']}",
        )
        return {"type": "alert", "status": "CREATED", "alert_id": alert["id"]}

    if action_type == "sync":
        from ..sync.service import SyncService

        kind = str(action.get("kind", "wallets"))
        service = SyncService(state)
        if kind == "wallets":
            result = await service.sync_wallets()
        elif kind == "activity":
            result = await service.sync_activity()
        elif kind == "prices":
            result = await service.sync_prices()
        else:
            result = await service.sync_risk()
        return {"type": "sync", "kind": kind, "status": result.get("status")}

    # Transaction actions remain paper-only unless the normal execution API
    # is explicitly used with ENABLE_LIVE_EXECUTION=true and its own
    # confirmation/simulation requirements.
    return {
        "type": action_type,
        "status": "GATED",
        "detail": "Strategy action type is recorded but not broadcast directly by the scheduler.",
    }


def _strategy_candidates(state) -> list[dict[str, Any]]:
    payload = state.vault.data()
    candidates = []
    from ..core.portfolio import PortfolioService

    candidates.append({"source": "portfolio", **PortfolioService(state).summary()})
    for mint, asset in payload.get("assets", {}).items():
        for wallet_id, holding in asset.get("holdings", {}).items():
            candidates.append(
                {
                    "source": "asset",
                    "mint": mint,
                    "wallet_id": wallet_id,
                    **holding,
                    "asset": asset,
                }
            )
    return candidates


def _resolve(candidate: dict[str, Any], field: str) -> Any:
    value: Any = candidate
    for part in field.split("."):
        if isinstance(value, dict):
            value = value.get(part)
        else:
            return None
    return value


def _matches(rule: dict[str, Any], candidates: list[dict[str, Any]], strategy: dict[str, Any]) -> bool:
    source = str(rule.get("source", "portfolio"))
    operator_name = str(rule.get("operator", "gt"))
    threshold = float(rule.get("threshold", 0))
    for candidate in candidates:
        if candidate.get("source") != source:
            continue
        if rule.get("wallet_id") and candidate.get("wallet_id") != rule.get("wallet_id"):
            continue
        if rule.get("mint") and candidate.get("mint") != rule.get("mint"):
            continue
        value = _resolve(candidate, str(rule.get("field", "")))
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        if OPERATORS[operator_name](numeric, threshold):
            return True
    return False