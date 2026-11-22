from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.api.deps import require_session
from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.rpc.health import RPCHealth


class FakeResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {"jsonrpc": "2.0", "id": 1, "result": "ok"}

    def json(self) -> dict:
        return self._payload


class FakeClient:
    def __init__(self, response: FakeResponse) -> None:
        self.response = response

    async def __aenter__(self) -> "FakeClient":
        return self

    async def __aexit__(self, *args) -> None:
        return None

    async def post(self, *args, **kwargs) -> FakeResponse:
        return self.response


def test_rpc_probe_records_real_health(monkeypatch: pytest.MonkeyPatch) -> None:
    response = FakeResponse()
    monkeypatch.setattr(
        "backend.rpc.health.httpx.AsyncClient",
        lambda **kwargs: FakeClient(response),
    )

    endpoint = RPCHealth(url="https://example.invalid", network="mainnet-beta")
    result = asyncio.run(endpoint.probe())

    assert result["status"] == "OK"
    assert result["successes"] == 1
    assert result["failures"] == 0
    assert result["last_checked_at"] is not None
    assert result["latency_ms"] is not None


def test_rpc_probe_records_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    response = FakeResponse(status_code=429)
    monkeypatch.setattr(
        "backend.rpc.health.httpx.AsyncClient",
        lambda **kwargs: FakeClient(response),
    )

    endpoint = RPCHealth(url="https://example.invalid", network="mainnet-beta")
    result = asyncio.run(endpoint.probe())

    assert result["status"] == "RATE_LIMITED"
    assert result["successes"] == 0
    assert result["failures"] == 1


def test_require_session_rejects_missing_token(tmp_path) -> None:
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    state = AppState(vault)

    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(sv=state)))

    with pytest.raises(HTTPException) as exc:
        require_session(request, None)

    assert exc.value.status_code == 401


def test_require_session_accepts_valid_token(tmp_path) -> None:
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    state = AppState(vault)
    session = state.create_session()

    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(sv=state)))

    assert require_session(request, session.token) is state