from __future__ import annotations

import asyncio

from ..api.strategies import run_strategy


class StrategyWorker:
    def __init__(self, state, interval_seconds: int = 30) -> None:
        self.state = state
        self.interval = max(10, interval_seconds)
        self._stop = asyncio.Event()

    async def run_once(self) -> None:
        if not self.state.vault.unlocked:
            return
        strategies = list(self.state.vault.data().get("strategies", []))
        for strategy in strategies:
            if not strategy.get("enabled"):
                continue
            last = strategy.get("last_run_at")
            if last and not _due(last, int(strategy.get("interval_seconds", self.interval))):
                continue
            try:
                await run_strategy(str(strategy["id"]), self.state)
            except Exception as exc:
                await self.state.emit(
                    "strategy.run",
                    {
                        "strategy_id": strategy.get("id"),
                        "status": "ERROR",
                        "error": type(exc).__name__,
                    },
                )

    async def start(self) -> None:
        while not self._stop.is_set():
            try:
                await self.run_once()
            except Exception as exc:
                await self.state.emit(
                    "strategy.scheduler",
                    {"status": "ERROR", "error": type(exc).__name__},
                )
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                continue

    async def stop(self) -> None:
        self._stop.set()


def _due(last_run: str, interval_seconds: int) -> bool:
    from datetime import datetime, timezone

    try:
        previous = datetime.fromisoformat(last_run)
    except ValueError:
        return True
    return (
        datetime.now(timezone.utc) - previous
    ).total_seconds() >= max(10, interval_seconds)