from __future__ import annotations

from typing import Any, Awaitable, Callable


class RPCFailover:
    def __init__(self, pool, max_attempts: int = 3) -> None:
        self.pool = pool
        self.max_attempts = max_attempts

    async def execute(self, network: str, operation: Callable[[str], Awaitable[Any]]) -> Any:
        tried: set[str] = set()
        last_exc: Exception | None = None
        for _ in range(self.max_attempts):
            endpoint = self.pool.pick(network)
            if not endpoint or endpoint.url in tried:
                break
            tried.add(endpoint.url)
            try:
                return await operation(endpoint.url)
            except Exception as exc:
                last_exc = exc
                endpoint.failures += 1
                endpoint.status = "ERROR"
        if last_exc:
            raise last_exc
        raise RuntimeError("No healthy RPC endpoint available")