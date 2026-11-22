from __future__ import annotations

import time
from typing import Any

import httpx


class HttpProvider:
    name = "base"
    default_base_url = ""
    capabilities: set[str] = set()
    requires_api_key = True
    health_path: str | None = None
    health_params: dict[str, Any] | None = None

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float = 15.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = (base_url or self.default_base_url).rstrip("/")
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers = {"accept": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"
        return headers

    def configured(self) -> bool:
        return bool(self.base_url and (self.api_key or not self.requires_api_key))

    async def request_json(
        self,
        method: str,
        path: str = "",
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, Any] | list[Any]]:
        request_headers = self._headers()
        if headers:
            request_headers.update(headers)
        async with httpx.AsyncClient(timeout=self.timeout, headers=request_headers) as client:
            response = await client.request(
                method,
                f"{self.base_url}/{path.lstrip('/')}" if path else self.base_url,
                params=params,
                json=json,
            )
        response.raise_for_status()
        return response.status_code, response.json()

    async def health(self) -> dict[str, Any]:
        started = time.perf_counter()

        if not self.base_url or (self.requires_api_key and not self.api_key):
            return {
                "provider": self.name,
                "status": "UNCONFIGURED",
                "configured": False,
                "latency_ms": None,
            }

        path = self.health_path
        if path is None:
            return {
                "provider": self.name,
                "status": "UNVERIFIED",
                "configured": True,
                "latency_ms": None,
                "detail": "This provider does not define a provider-specific health request.",
            }

        try:
            status_code, _ = await self.request_json(
                "GET",
                path,
                params=self.health_params,
            )
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            if status_code == 429:
                status = "RATE_LIMITED"
            elif 401 <= status_code <= 403:
                status = "UNAUTHORIZED"
            elif 200 <= status_code < 300:
                status = "OK"
            else:
                status = "DEGRADED"
            return {
                "provider": self.name,
                "status": status,
                "configured": True,
                "http_status": status_code,
                "latency_ms": latency_ms,
            }
        except httpx.TimeoutException:
            return {
                "provider": self.name,
                "status": "TIMEOUT",
                "configured": True,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            }
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            return {
                "provider": self.name,
                "status": "RATE_LIMITED" if code == 429 else (
                    "UNAUTHORIZED" if code in {401, 403} else "DEGRADED"
                ),
                "configured": True,
                "http_status": code,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            }
        except Exception as exc:
            return {
                "provider": self.name,
                "status": "ERROR",
                "configured": True,
                "error": type(exc).__name__,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            }

    async def token_price(self, mint: str) -> float | None:
        return None