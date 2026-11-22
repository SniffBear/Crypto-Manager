from pathlib import Path

from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.core.wallets import WalletService
from backend.sync.reconciliation import PortfolioReconciliationService


def test_reconciliation_balance_snapshot_and_history(tmp_path: Path):
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    state = AppState(vault)
    wallet = WalletService(state).create(label="Watch target")
    state.vault.data()["assets"] = {
        "SOL": {
            "symbol": "SOL",
            "holdings": {wallet["id"]: {"amount": 1.25, "decimals": 9, "updated_at": "2026-01-01T00:00:00+00:00", "source": "solana_rpc"}},
        }
    }
    service = PortfolioReconciliationService(state)
    balances = service._wallet_balances(wallet["id"])
    assert balances["SOL"]["amount"] == 1.25
    assert service.latest()["status"] == "NOT_RUN"
    assert service.history() == []