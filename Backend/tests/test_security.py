from pathlib import Path

from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.core.wallets import WalletService


def test_new_vault_uses_argon2_and_password_clears_on_lock(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")

    metadata = vm.metadata()
    assert metadata["kdf"] == "Argon2id"
    assert metadata["format_version"] == 2
    assert metadata["argon2_memory_kib"] >= 64 * 1024

    vm.lock()
    assert vm.unlocked is False
    assert vm._password is None


def test_wallet_create_does_not_return_secret_but_explicit_export_does(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    state = AppState(vm)
    service = WalletService(state)

    wallet = service.create(label="Wallet 01")
    assert wallet["address"]
    assert "secret_key_b58" not in wallet

    secret = service.export_secret(wallet["id"])
    assert secret
    assert vm.verify_password("a-very-strong-password") is True
    assert vm.verify_password("wrong-password") is False


def test_unlock_backoff_increases_and_success_resets(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    state = AppState(vm)

    first = state.record_unlock_failure()
    assert first == 1
    assert state.unlock_allowed() is False

    state.record_unlock_success()
    assert state.unlock_allowed() is True
    assert state.unlock_retry_after() == 0


def test_base58_decoder_rejects_empty_input():
    from backend.core.wallets import b58decode

    try:
        b58decode("")
    except ValueError:
        pass
    else:
        raise AssertionError("empty base58 input must be rejected")


def test_import_secret_rejects_mismatched_64_byte_public_suffix(tmp_path: Path):
    from backend.core.wallets import WalletService, b58encode
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    state = AppState(vm)
    seed = bytes(range(32))
    key = Ed25519PrivateKey.from_private_bytes(seed)
    other_public = Ed25519PrivateKey.generate().public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    malformed = b58encode(seed + other_public)

    try:
        WalletService(state).import_secret(secret_key=malformed, label="invalid")
    except ValueError as exc:
        assert "public-key suffix" in str(exc)
    else:
        raise AssertionError("invalid 64-byte secret-key suffix must be rejected")