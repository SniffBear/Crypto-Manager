from __future__ import annotations

import asyncio

from ..sync.service import SyncService


class RiskSyncWorker:
    def __init__(self, state, interval_seconds: int = 60) -> None:
        self.state = state
        self.interval = max(30, interval_seconds)
        self._stop = asyncio.Event()

    async def run_once(self) -> None:
        if self.state.vault.unlocked:
            await SyncService(self.state).sync_risk()

    async def start(self) -> None:
        while not self._stop.is_set():
            try:
                await self.run_once()
            except Exception as exc:
                await self.state.emit(
                    "sync.risk",
                    {"status": "ERROR", "error": type(exc).__name__},
                )
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                continue

    async def stop(self) -> None:
        self._stop.set()