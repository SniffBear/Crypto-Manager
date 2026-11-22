from __future__ import annotations

import asyncio
from typing import Any

import httpx

from .health import RPCHealth


class RPCPool:
    def __init__(self, config: list[dict[str, Any]] | None = None) -> None:
        self._endpoints: list[RPCHealth] = [RPCHealth(**item) for item in (config or [])]

    def list(self) -> list[dict[str, Any]]:
        return [e.__dict__.copy() for e in self._endpoints]

    async def probe_all(self) -> list[dict[str, Any]]:
        if not self._endpoints:
            return []
        return list(await asyncio.gather(*(endpoint.probe() for endpoint in self._endpoints)))

    def add(
        self,
        *,
        url: str,
        network: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        e = RPCHealth(url=url, network=network, metadata=metadata or {})
        self._endpoints.append(e)
        return e.__dict__.copy()

    def remove(self, url: str) -> None:
        self._endpoints = [e for e in self._endpoints if e.url != url]

    def candidates(self, network: str) -> list[RPCHealth]:
        candidates = [
            endpoint
            for endpoint in self._endpoints
            if endpoint.network == network
            and endpoint.status not in {"DOWN", "ERROR", "UNAUTHORIZED", "TIMEOUT"}
        ]
        candidates.sort(
            key=lambda endpoint: (
                endpoint.status != "OK",
                endpoint.latency_ms if endpoint.latency_ms is not None else 1e9,
                -endpoint.successes,
            )
        )
        return candidates

    def pick(self, network: str) -> RPCHealth | None:
        candidates = self.candidates(network)
        return candidates[0] if candidates else None

    async def request(
        self,
        *,
        network: str,
        method: str,
        params: list[Any] | None = None,
        timeout: float = 15.0,
    ) -> dict[str, Any]:
        candidates = self.candidates(network)
        if not candidates:
            await self.probe_all()
            candidates = self.candidates(network)
        if not candidates:
            raise RuntimeError(f"No healthy RPC endpoints configured for {network}")

        failures: list[str] = []
        for endpoint in candidates:
            started = asyncio.get_running_loop().time()
            headers = {"accept": "application/json", "content-type": "application/json"}
            configured_headers = endpoint.metadata.get("headers")
            if isinstance(configured_headers, dict):
                headers.update({str(k): str(v) for k, v in configured_headers.items()})

            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        endpoint.url,
                        json={
                            "jsonrpc": "2.0",
                            "id": 1,
                            "method": method,
                            "params": params or [],
                        },
                        headers=headers,
                    )
                latency_ms = round((asyncio.get_running_loop().time() - started) * 1000, 2)

                if response.status_code == 429:
                    endpoint.record(success=False, latency_ms=latency_ms, status="RATE_LIMITED")
                    failures.append(f"{endpoint.url}: rate limited")
                    continue
                if response.status_code in {401, 403}:
                    endpoint.record(success=False, latency_ms=latency_ms, status="UNAUTHORIZED")
                    failures.append(f"{endpoint.url}: unauthorized")
                    continue
                if response.status_code >= 500:
                    endpoint.record(success=False, latency_ms=latency_ms, status="DEGRADED")
                    failures.append(f"{endpoint.url}: http {response.status_code}")
                    continue
                response.raise_for_status()

                payload = response.json()
                if "error" in payload:
                    endpoint.record(success=False, latency_ms=latency_ms, status="DEGRADED")
                    failures.append(f"{endpoint.url}: rpc error")
                    continue

                endpoint.record(success=True, latency_ms=latency_ms, status="OK")
                return payload
            except httpx.TimeoutException:
                endpoint.record(
                    success=False,
                    latency_ms=round((asyncio.get_running_loop().time() - started) * 1000, 2),
                    status="TIMEOUT",
                )
                failures.append(f"{endpoint.url}: timeout")
            except (httpx.HTTPError, ValueError):
                endpoint.record(
                    success=False,
                    latency_ms=round((asyncio.get_running_loop().time() - started) * 1000, 2),
                    status="ERROR",
                )
                failures.append(f"{endpoint.url}: request failed")

        raise RuntimeError("All RPC endpoints failed")