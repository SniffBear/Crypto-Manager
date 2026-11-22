from pathlib import Path
import pytest

from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.core.wallets import WalletService
from backend.core.address_book import AddressBookService


def state_for(tmp_path: Path):
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    return AppState(vault)


def test_contact_create_list_trust_and_delete(tmp_path: Path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Destination")
    service = AddressBookService(state)

    contact = service.add(label="Cold wallet", address=wallet["address"], network="solana", trusted=False)
    assert service.list("solana")[0]["id"] == contact["id"]
    assert service.recipient_status(wallet["address"])["requires_confirmation"] is True

    service.update(contact["id"], trusted=True)
    status = service.recipient_status(wallet["address"])
    assert status["known"] is True
    assert status["trusted"] is True
    assert status["requires_confirmation"] is False

    service.delete(contact["id"])
    assert service.list() == []


def test_contact_duplicates_are_network_scoped(tmp_path: Path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Destination")
    service = AddressBookService(state)
    service.add(label="Solana", address=wallet["address"], network="solana")
    with pytest.raises(ValueError, match="already exists"):
        service.add(label="Duplicate", address=wallet["address"], network="solana")
    # Other network address formats are not validated with Solana rules.
    service.add(label="Bitcoin contact", address="bc1qexampleaddress", network="bitcoin")
    assert len(service.list()) == 2


def test_new_recipient_confirmation_policy_can_be_disabled(tmp_path: Path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Destination")
    service = AddressBookService(state)
    assert service.recipient_status(wallet["address"])["requires_confirmation"] is True
    state.vault.data()["settings"]["require_new_recipient_confirmation"] = False
    assert service.recipient_status(wallet["address"])["requires_confirmation"] is False