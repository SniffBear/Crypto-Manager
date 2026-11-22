from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.deps import require_session
from backend.api.feature_suite import router
from backend.core.state import AppState
from backend.core.vault import VaultManager


def client_for(tmp_path: Path):
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    state = AppState(vault)
    app = FastAPI()
    app.state.sv = state
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[require_session] = lambda: state
    return TestClient(app), state


def test_feature_status_reports_hardware_exclusion_and_native_adapter_gaps(tmp_path):
    client, _state = client_for(tmp_path)
    response = client.get("/api/v1/features/status")
    assert response.status_code == 200
    body = response.json()
    assert body["hardware_wallets"] == "NOT_IMPLEMENTED_BY_USER_REQUEST"
    assert body["native_network_adapters"]["solana"] == "LIVE"
    assert body["native_network_adapters"]["bitcoin"] == "NOT_IMPLEMENTED"


def test_security_alert_acknowledgement_and_network_matrix_endpoints(tmp_path):
    client, state = client_for(tmp_path)
    state.vault.data()["execution_records"] = [{"id": "failed-api", "state": "FAILED", "created_at": "2026-11-22T10:00:00+00:00"}]
    alerts = client.get("/api/v1/features/security-alerts")
    assert alerts.status_code == 200 and alerts.json()[0]["code"] == "EXECUTION_FAILED"
    alert_id = alerts.json()[0]["id"]
    ack = client.post(f"/api/v1/features/security-alerts/{alert_id}/acknowledge", json={"confirm": True})
    assert ack.status_code == 200
    assert client.get("/api/v1/features/security-alerts").json() == []
    matrix = client.get("/api/v1/features/network-capabilities")
    assert matrix.status_code == 200
    assert len(matrix.json()) == 10


def test_backup_inventory_and_recovery_checklist_endpoints(tmp_path):
    client, state = client_for(tmp_path)
    backup_dir = state.vault.path.parent / "backups"
    backup_dir.mkdir()
    (backup_dir / "example.svault").write_bytes(b"ciphertext")
    inventory = client.get("/api/v1/features/backups/inventory?verify_hashes=true")
    assert inventory.status_code == 200
    assert inventory.json()["hashes_checked"] is True
    assert inventory.json()["backups"][0]["integrity"] == "MANIFEST_MISSING"
    recovery = client.get("/api/v1/features/recovery-checklist")
    assert recovery.status_code == 200
    assert recovery.json()["restore_tested_by_application"] is False