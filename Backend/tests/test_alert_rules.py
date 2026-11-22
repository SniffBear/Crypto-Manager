from pathlib import Path

from backend.core.alerts import AlertService
from backend.core.state import AppState
from backend.core.vault import VaultManager


def test_alert_rule_evaluation_creates_alert(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    state = AppState(vm)
    vm.data()["wallets"] = [{"id": "w1", "address": "A"}]
    vm.data()["assets"] = {
        "MINT": {
            "mint": "MINT",
            "holdings": {
                "w1": {
                    "wallet_id": "w1",
                    "amount": 2,
                    "value_usd": 25,
                }
            },
            "wallet_ids": ["w1"],
        }
    }
    service = AlertService(state)
    rule = service.create_rule(
        {
            "source": "asset",
            "field": "value_usd",
            "operator": "gt",
            "threshold": 20,
            "wallet_id": "w1",
            "mint": "MINT",
            "title": "Value trigger",
            "message": "Value exceeded threshold",
            "cooldown_seconds": 300,
        }
    )

    import asyncio
    result = asyncio.run(service.evaluate())

    assert result["triggered"] == 1
    alerts = service.list()
    assert alerts[0]["kind"] == f"rule:{rule['id']}"