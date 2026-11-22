from __future__ import annotations

import asyncio
import math
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from .vault import VaultManager
from .rate_limit import UnlockRateLimiter


@dataclass
class Session:
    token: str
    created_at: datetime
    expires_at: datetime
    last_seen: datetime
    session_id: str
    device_name: str = "Nexus Crypto Manager client"


class AppState:
    def __init__(
        self,
        vault: VaultManager,
        session_ttl_seconds: int = 8 * 60 * 60,
        session_idle_seconds: int = 30 * 60,
        redis_url: str | None = None,
    ) -> None:
        self.vault = vault
        self.event_bus = EventBus()
        self.session_ttl_seconds = session_ttl_seconds
        self.session_idle_seconds = session_idle_seconds
        self.sessions: dict[str, Session] = {}
        self.mutex = asyncio.Lock()
        self.services: dict[str, Any] = {}
        self.unlock_rate_limiter = UnlockRateLimiter(redis_url)
        self._unlock_failures = 0
        self._unlock_blocked_until = 0.0

    def create_session(self, device_name: str = "Nexus Crypto Manager client") -> Session:
        now = datetime.now(timezone.utc)
        safe_device_name = " ".join(str(device_name).split())[:80] or "Nexus Crypto Manager client"
        session = Session(
            token=secrets.token_urlsafe(32),
            created_at=now,
            expires_at=now.fromtimestamp(
                now.timestamp() + self.session_ttl_seconds,
                tz=timezone.utc,
            ),
            last_seen=now,
            session_id=secrets.token_hex(12),
            device_name=safe_device_name,
        )
        self.sessions[session.token] = session
        return session

    def revoke_sessions(self) -> None:
        self.sessions.clear()

    def validate_session(self, token: str | None) -> bool:
        if not token:
            return False
        session = self.sessions.get(token)
        if not session:
            return False

        now = datetime.now(timezone.utc)
        if now >= session.expires_at:
            self.sessions.pop(token, None)
            return False
        idle_seconds = (now - session.last_seen).total_seconds()
        if idle_seconds >= self.session_idle_seconds:
            self.sessions.pop(token, None)
            return False

        session.last_seen = now
        return True

    def unlock_retry_after(self) -> int:
        remaining = self._unlock_blocked_until - time.monotonic()
        return max(0, math.ceil(remaining))

    def unlock_allowed(self) -> bool:
        return self.unlock_retry_after() == 0

    def record_unlock_failure(self) -> int:
        self._unlock_failures += 1
        # Exponential backoff capped at five minutes. This is process-local,
        # intentionally conservative, and resets after a successful unlock.
        delay = min(300, 2 ** min(self._unlock_failures - 1, 8))
        self._unlock_blocked_until = time.monotonic() + delay
        return delay

    def record_unlock_success(self) -> None:
        self._unlock_failures = 0
        self._unlock_blocked_until = 0.0

    async def emit(self, kind: str, data: dict[str, Any]) -> None:
        await self.event_bus.publish({
            "kind": kind,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        })


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=250)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    async def publish(self, event: dict[str, Any]) -> None:
        stale: list[asyncio.Queue] = []
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                stale.append(q)
        for q in stale:
            self._subscribers.discard(q)