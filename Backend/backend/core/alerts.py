from __future__ import annotations

import operator
import secrets
from datetime import datetime, timezone
from typing import Any, Callable

from .state import AppState


OPERATORS: dict[str, Callable[[float, float], bool]] = {
    "gt": operator.gt,
    "gte": operator.ge,
    "lt": operator.lt,
    "lte": operator.le,
    "eq": operator.eq,
    "neq": operator.ne,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_path(data: Any, path: str) -> Any:
    current = data
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


class AlertService:
    def __init__(self, state: AppState) -> None:
        self.state = state

    def list(self, unread_only: bool = False) -> list[dict[str, Any]]:
        alerts = self.state.vault.data().setdefault("alerts", [])
        if unread_only:
            alerts = [a for a in alerts if not a.get("read")]
        return list(reversed(alerts))

    async def create(
        self,
        *,
        level: str,
        title: str,
        message: str,
        wallet_id: str | None = None,
        kind: str = "system",
    ) -> dict[str, Any]:
        alert = {
            "id": secrets.token_hex(8),
            "level": level,
            "title": title,
            "message": message,
            "wallet_id": wallet_id,
            "kind": kind,
            "read": False,
            "created_at": now_iso(),
        }
        self.state.vault.data().setdefault("alerts", []).append(alert)
        self.state.vault.save()
        await self.state.emit("alert.created", alert)
        return alert

    def list_rules(self) -> list[dict[str, Any]]:
        return list(reversed(self.state.vault.data().setdefault("alert_rules", [])))

    def create_rule(self, rule: dict[str, Any]) -> dict[str, Any]:
        operator_name = str(rule.get("operator", "gt"))
        if operator_name not in OPERATORS:
            raise ValueError("Unsupported alert operator")
        if not rule.get("field"):
            raise ValueError("Alert rule field is required")
        item = {
            "id": secrets.token_hex(8),
            "enabled": bool(rule.get("enabled", True)),
            "source": str(rule.get("source", "portfolio")),
            "field": str(rule["field"]),
            "operator": operator_name,
            "threshold": float(rule.get("threshold", 0)),
            "wallet_id": rule.get("wallet_id"),
            "mint": rule.get("mint"),
            "level": str(rule.get("level", "warning")),
            "title": str(rule.get("title") or "Alert rule triggered"),
            "message": str(rule.get("message") or "Configured alert condition matched."),
            "cooldown_seconds": int(rule.get("cooldown_seconds", 300)),
            "last_triggered_at": None,
            "created_at": now_iso(),
        }
        self.state.vault.data().setdefault("alert_rules", []).append(item)
        self.state.vault.save()
        return item

    def delete_rule(self, rule_id: str) -> None:
        rules = self.state.vault.data().setdefault("alert_rules", [])
        before = len(rules)
        self.state.vault.data()["alert_rules"] = [r for r in rules if r.get("id") != rule_id]
        if len(self.state.vault.data()["alert_rules"]) == before:
            raise KeyError("Alert rule not found")
        self.state.vault.save()

    async def evaluate(self) -> dict[str, Any]:
        payload = self.state.vault.data()
        rules = payload.setdefault("alert_rules", [])
        triggered = 0
        checked = 0
        now = datetime.now(timezone.utc)

        candidates: list[dict[str, Any]] = []
        try:
            from .portfolio import PortfolioService
            candidates.append({"source": "portfolio", **PortfolioService(self.state).summary()})
        except Exception:
            pass

        for mint, asset in payload.get("assets", {}).items():
            for wallet_id, holding in asset.get("holdings", {}).items():
                candidates.append(
                    {
                        "source": "asset",
                        "mint": mint,
                        "wallet_id": wallet_id,
                        "asset": asset,
                        "holding": holding,
                        **holding,
                    }
                )

        for activity in payload.get("activity", [])[-200:]:
            candidates.append({"source": "activity", **activity})

        for execution in payload.get("execution_records", [])[-100:]:
            candidates.append({"source": "execution", **execution})

        for rule in rules:
            if not rule.get("enabled"):
                continue
            checked += 1
            if not _rule_ready(rule, now):
                continue
            for candidate in candidates:
                if candidate.get("source") != rule.get("source"):
                    continue
                if rule.get("wallet_id") and candidate.get("wallet_id") != rule.get("wallet_id"):
                    continue
                if rule.get("mint") and candidate.get("mint") != rule.get("mint"):
                    continue
                raw = _get_path(candidate, str(rule["field"]))
                if isinstance(raw, bool):
                    actual = 1.0 if raw else 0.0
                else:
                    try:
                        actual = float(raw)
                    except (TypeError, ValueError):
                        continue
                if OPERATORS[rule["operator"]](actual, float(rule["threshold"])):
                    alert = await self.create(
                        level=rule["level"],
                        title=rule["title"],
                        message=f'{rule["message"]} Observed {actual}; threshold {rule["threshold"]}.',
                        wallet_id=candidate.get("wallet_id"),
                        kind=f"rule:{rule['id']}",
                    )
                    rule["last_triggered_at"] = now.isoformat()
                    triggered += 1
                    break

        self.state.vault.save()
        return {
            "status": "READY",
            "rules_checked": checked,
            "triggered": triggered,
            "updated_at": now_iso(),
        }

    def mark_read(self, alert_id: str) -> None:
        for alert in self.state.vault.data().setdefault("alerts", []):
            if alert["id"] == alert_id:
                alert["read"] = True
                self.state.vault.save()
                return
        raise KeyError("Alert not found")


def _rule_ready(rule: dict[str, Any], now: datetime) -> bool:
    stamp = rule.get("last_triggered_at")
    if not stamp:
        return True
    try:
        previous = datetime.fromisoformat(str(stamp))
        return (now - previous).total_seconds() >= int(rule.get("cooldown_seconds", 300))
    except ValueError:
        return True