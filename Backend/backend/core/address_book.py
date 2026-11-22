from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from .state import AppState
from .wallets import b58decode


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AddressBookService:
    """Network-scoped contacts stored inside the encrypted vault payload."""

    def __init__(self, state: AppState) -> None:
        self.state = state

    @staticmethod
    def normalize_network(network: str) -> str:
        value = network.strip().lower().replace(" ", "-")
        if not value or len(value) > 64:
            raise ValueError("A valid network identifier is required")
        return value

    @staticmethod
    def validate_address(network: str, address: str) -> str:
        value = address.strip()
        if not value or len(value) > 256 or any(ch.isspace() for ch in value):
            raise ValueError("Address is empty or malformed")
        # The current wallet engine only implements Solana keys. Other chain
        # identifiers can be stored as contacts, but are not falsely validated
        # using Solana's Base58 rules.
        if network == "solana":
            try:
                if len(b58decode(value)) != 32:
                    raise ValueError
            except ValueError as exc:
                raise ValueError("Invalid Solana address") from exc
        return value

    def list(self, network: str | None = None) -> list[dict[str, Any]]:
        entries = self.state.vault.data().setdefault("address_book", [])
        if network:
            network = self.normalize_network(network)
            entries = [item for item in entries if item.get("network") == network]
        return sorted(entries, key=lambda item: (item.get("label", "").lower(), item.get("created_at", "")))

    def add(self, *, label: str, address: str, network: str = "solana", notes: str = "", trusted: bool = False) -> dict[str, Any]:
        label = label.strip()
        if not label or len(label) > 80:
            raise ValueError("Contact name must be between 1 and 80 characters")
        if len(notes) > 500:
            raise ValueError("Notes must be 500 characters or fewer")
        network = self.normalize_network(network)
        address = self.validate_address(network, address)
        entries = self.state.vault.data().setdefault("address_book", [])
        if any(item.get("network") == network and item.get("address") == address for item in entries):
            raise ValueError("This address already exists for this network")
        item = {
            "id": secrets.token_hex(12), "label": label, "address": address,
            "network": network, "notes": notes.strip(), "trusted": bool(trusted),
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        entries.append(item)
        self.state.vault.save()
        return item

    def update(self, contact_id: str, **changes: Any) -> dict[str, Any]:
        entries = self.state.vault.data().setdefault("address_book", [])
        item = next((x for x in entries if x.get("id") == contact_id), None)
        if not item:
            raise KeyError("Contact not found")
        if "label" in changes:
            label = str(changes["label"]).strip()
            if not label or len(label) > 80:
                raise ValueError("Contact name must be between 1 and 80 characters")
            item["label"] = label
        if "notes" in changes:
            notes = str(changes["notes"] or "")
            if len(notes) > 500:
                raise ValueError("Notes must be 500 characters or fewer")
            item["notes"] = notes
        if "trusted" in changes:
            item["trusted"] = bool(changes["trusted"])
        item["updated_at"] = now_iso()
        self.state.vault.save()
        return item

    def delete(self, contact_id: str) -> None:
        entries = self.state.vault.data().setdefault("address_book", [])
        before = len(entries)
        entries[:] = [x for x in entries if x.get("id") != contact_id]
        if len(entries) == before:
            raise KeyError("Contact not found")
        self.state.vault.save()

    def recipient_status(self, address: str, network: str = "solana") -> dict[str, Any]:
        network = self.normalize_network(network)
        address = self.validate_address(network, address)
        item = next((x for x in self.state.vault.data().setdefault("address_book", [])
                     if x.get("network") == network and x.get("address") == address), None)
        data = self.state.vault.data()
        legacy_setting = data.setdefault("settings", {}).get("require_new_recipient_confirmation", True)
        policy_setting = data.setdefault("transaction_policy", {}).get("require_new_recipient_confirmation")
        require_confirmation = bool(legacy_setting if policy_setting is None else policy_setting)
        return {
            "known": item is not None,
            "trusted": bool(item and item.get("trusted")),
            "contact_id": item.get("id") if item else None,
            "label": item.get("label") if item else None,
            "requires_confirmation": bool(require_confirmation and (item is None or not item.get("trusted"))),
        }