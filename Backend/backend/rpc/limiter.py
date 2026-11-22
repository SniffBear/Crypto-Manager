from __future__ import annotations

import asyncio
import random
import time


class RateLimiter:
    def __init__(self, min_interval_seconds: float = 0.2, max_concurrency: int = 4) -> None:
        self.min_interval = max(0.0, min_interval_seconds)
        self._last_request = 0.0
        self._lock = asyncio.Lock()
        self._sem = asyncio.Semaphore(max_concurrency)

    async def wait(self) -> None:
        async with self._sem:
            async with self._lock:
                now = time.monotonic()
                delay = self.min_interval - (now - self._last_request)
                if delay > 0:
                    await asyncio.sleep(delay + random.uniform(0, self.min_interval * 0.25))
                self._last_request = time.monotonic()