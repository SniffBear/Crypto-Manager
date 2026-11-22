from __future__ import annotations

import time
from typing import Any


class UnlockRateLimiter:
    """Distributed unlock limiter when REDIS_URL is configured.

    Without Redis, behavior falls back to the existing process-local state.
    The fallback remains safe but is explicitly not distributed.
    """

    def __init__(self, redis_url: str | None = None) -> None:
        self.redis_url = redis_url
        self._redis: Any = None
        self._failures = 0
        self._blocked_until = 0.0

    async def _client(self):
        if not self.redis_url:
            return None
        if self._redis is None:
            from redis.asyncio import Redis

            self._redis = Redis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def retry_after(self, key: str) -> int:
        redis = await self._client()
        if redis is not None:
            value = await redis.ttl(key)
            return max(0, int(value))
        return max(0, int(self._blocked_until - time.monotonic()))

    async def record_failure(self, key: str) -> int:
        redis = await self._client()
        if redis is not None:
            failures_key = f"{key}:failures"
            failures = int(await redis.incr(failures_key))
            await redis.expire(failures_key, 900)
            delay = min(300, 2 ** min(failures - 1, 8))
            await redis.setex(key, delay, "1")
            return delay

        self._failures += 1
        delay = min(300, 2 ** min(self._failures - 1, 8))
        self._blocked_until = time.monotonic() + delay
        return delay

    async def reset(self, key: str) -> None:
        redis = await self._client()
        if redis is not None:
            await redis.delete(key, f"{key}:failures")
            return
        self._failures = 0
        self._blocked_until = 0.0

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.close()
            self._redis = None