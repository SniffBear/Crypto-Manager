from pathlib import Path

from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.core.wallets import WalletService


def test_vault_roundtrip(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    assert vm.unlocked
    vm.data()["settings"]["x"] = 1
    vm.save()
    vm.lock()
    vm.unlock("a-very-strong-password")
    assert vm.data()["settings"]["x"] == 1


def test_wallet_generation_and_watch_only(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    state = AppState(vm)
    svc = WalletService(state)

    wallet = svc.create(label="Wallet 01")
    assert wallet["address"]
    assert "secret_key_b58" not in wallet
    assert svc.export_secret(wallet["id"])

    wo = svc.import_watch_only(address=wallet["address"], label="Watch")
    assert wo["watch_only"] is True