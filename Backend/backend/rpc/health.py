from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx


@dataclass
class RPCHealth:
    url: str
    network: str
    status: str = "UNKNOWN"
    latency_ms: float | None = None
    failures: int = 0
    successes: int = 0
    last_checked_at: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def record(self, *, success: bool, latency_ms: float | None, status: str) -> None:
        self.status = status
        self.latency_ms = latency_ms
        self.last_checked_at = datetime.now(timezone.utc).isoformat()
        if success:
            self.successes += 1
        else:
            self.failures += 1

    async def probe(self, timeout: float = 5.0) -> dict[str, Any]:
        """Perform a real Solana JSON-RPC health probe."""
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.url,
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getHealth",
                        "params": [],
                    },
                    headers={"accept": "application/json"},
                )
            latency_ms = round((time.perf_counter() - started) * 1000, 2)

            if response.status_code == 429:
                self.record(success=False, latency_ms=latency_ms, status="RATE_LIMITED")
            elif response.status_code in {401, 403}:
                self.record(success=False, latency_ms=latency_ms, status="UNAUTHORIZED")
            elif response.status_code >= 500:
                self.record(success=False, latency_ms=latency_ms, status="DEGRADED")
            else:
                payload = response.json()
                rpc_ok = payload.get("result") == "ok"
                self.record(
                    success=rpc_ok,
                    latency_ms=latency_ms,
                    status="OK" if rpc_ok else "DEGRADED",
                )
        except httpx.TimeoutException:
            self.record(
                success=False,
                latency_ms=round((time.perf_counter() - started) * 1000, 2),
                status="TIMEOUT",
            )
        except (httpx.HTTPError, ValueError):
            self.record(
                success=False,
                latency_ms=round((time.perf_counter() - started) * 1000, 2),
                status="ERROR",
            )
        return self.__dict__.copy()