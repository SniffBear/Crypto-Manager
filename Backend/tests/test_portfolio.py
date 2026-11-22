from pathlib import Path

from backend.core.portfolio import PortfolioService
from backend.core.state import AppState
from backend.core.vault import VaultManager


def test_portfolio_uses_per_wallet_holdings_without_double_counting(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    vm.data()["wallets"] = [
        {"id": "w1", "address": "A"},
        {"id": "w2", "address": "B"},
    ]
    vm.data()["assets"] = {
        "MINT": {
            "mint": "MINT",
            "holdings": {
                "w1": {"wallet_id": "w1", "amount": 2, "value_usd": 20},
                "w2": {"wallet_id": "w2", "amount": 3, "value_usd": 30},
            },
            "wallet_ids": ["w1", "w2"],
        }
    }
    vm.save()

    summary = PortfolioService(AppState(vm)).summary()
    assert summary["total_value_usd"] == 50
    assert summary["wallet_values_usd"] == {"w1": 20, "w2": 30}