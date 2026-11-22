from __future__ import annotations

import asyncio

from ..sync.reconciliation import PortfolioReconciliationService


class PortfolioReconciliationWorker:
    def __init__(self, state, interval_seconds: int = 120) -> None:
        self.state = state
        self.interval = max(30, interval_seconds)
        self._stop = asyncio.Event()

    async def run_once(self) -> None:
        if self.state.vault.unlocked:
            await PortfolioReconciliationService(self.state).reconcile()

    async def start(self) -> None:
        while not self._stop.is_set():
            try:
                await self.run_once()
            except Exception as exc:
                await self.state.emit("portfolio.reconciliation", {"status": "ERROR", "error": type(exc).__name__})
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                continue

    async def stop(self) -> None:
        self._stop.set()