from __future__ import annotations

import base64
import secrets
from datetime import datetime, timezone
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from .state import AppState

ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(data: bytes) -> str:
    n = int.from_bytes(data, "big")
    out = ""
    while n:
        n, rem = divmod(n, 58)
        out = ALPHABET[rem] + out
    pad = len(data) - len(data.lstrip(b"\x00"))
    return "1" * pad + (out or ("1" if pad else ""))


def b58decode(text: str) -> bytes:
    if not isinstance(text, str) or not text:
        raise ValueError("Base58 value must be a non-empty string")
    n = 0
    for ch in text:
        if ch not in ALPHABET:
            raise ValueError("Invalid base58")
        n = n * 58 + ALPHABET.index(ch)
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    pad = len(text) - len(text.lstrip("1"))
    return b"\x00" * pad + raw


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def key_material_from_seed(seed: bytes) -> tuple[bytes, bytes, bytes]:
    key = Ed25519PrivateKey.from_private_bytes(seed)
    public = key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    secret64 = seed + public
    return seed, public, secret64


class WalletService:
    def __init__(self, state: AppState) -> None:
        self.state = state

    def list(self) -> list[dict[str, Any]]:
        return [self.public_view(w) for w in self.state.vault.data()["wallets"]]

    def get(self, wallet_id: str) -> dict[str, Any]:
        for wallet in self.state.vault.data()["wallets"]:
            if wallet["id"] == wallet_id:
                return self.public_view(wallet)
        raise KeyError("Wallet not found")

    def create(
        self,
        *,
        label: str,
        group: str | None = None,
        role: str = "standard",
        cold_storage: bool = False,
    ) -> dict[str, Any]:
        seed = Ed25519PrivateKey.generate().private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption(),
        )
        _, public, secret64 = key_material_from_seed(seed)
        wallet = {
            "id": secrets.token_hex(8),
            "address": b58encode(public),
            "secret_key_b58": b58encode(secret64),
            "secret_key_b64": base64.b64encode(secret64).decode(),
            "label": label,
            "group": group,
            "role": role,
            "watch_only": False,
            "cold_storage": cold_storage,
            "signing_enabled": not cold_storage,
            "broadcasting_enabled": not cold_storage,
            "secret_export_enabled": not cold_storage,
            "created_at": now_iso(),
            "notes": "",
            "tags": [],
        }
        self.state.vault.data()["wallets"].append(wallet)
        self.state.vault.save()
        # Private key material is intentionally not part of the standard
        # wallet response. Export is an explicit, re-authenticated action.
        return self.public_view(wallet)

    def import_secret(
        self,
        *,
        secret_key: str,
        label: str,
        group: str | None = None,
    ) -> dict[str, Any]:
        raw = b58decode(secret_key)
        if len(raw) not in (32, 64):
            raise ValueError("Secret key must decode to 32 or 64 bytes")
        seed = raw[:32]
        _, public, secret64 = key_material_from_seed(seed)
        # Solana 64-byte secret-key exports are seed || public-key. Do not
        # silently accept mismatched/corrupted public-key suffixes.
        if len(raw) == 64 and raw[32:] != public:
            raise ValueError("64-byte secret key has an invalid public-key suffix")
        wallet = {
            "id": secrets.token_hex(8),
            "address": b58encode(public),
            "secret_key_b58": b58encode(secret64),
            "secret_key_b64": base64.b64encode(secret64).decode(),
            "label": label,
            "group": group,
            "role": "imported",
            "watch_only": False,
            "cold_storage": False,
            "signing_enabled": True,
            "broadcasting_enabled": True,
            "secret_export_enabled": True,
            "created_at": now_iso(),
            "notes": "",
            "tags": [],
        }
        self.state.vault.data()["wallets"].append(wallet)
        self.state.vault.save()
        return self.public_view(wallet)

    def import_watch_only(
        self,
        *,
        address: str,
        label: str,
        group: str | None = None,
    ) -> dict[str, Any]:
        if len(b58decode(address)) != 32:
            raise ValueError("Invalid Solana public address")
        wallet = {
            "id": secrets.token_hex(8),
            "address": address,
            "label": label,
            "group": group,
            "role": "watch_only",
            "watch_only": True,
            "cold_storage": False,
            "signing_enabled": False,
            "broadcasting_enabled": False,
            "secret_export_enabled": False,
            "created_at": now_iso(),
            "notes": "",
            "tags": [],
        }
        self.state.vault.data()["wallets"].append(wallet)
        self.state.vault.save()
        return self.public_view(wallet)

    def export_secret(self, wallet_id: str) -> str:
        for wallet in self.state.vault.data()["wallets"]:
            if wallet["id"] != wallet_id:
                continue
            if wallet.get("watch_only") or not wallet.get("secret_export_enabled"):
                raise ValueError("Secret export is disabled for this wallet")
            secret = wallet.get("secret_key_b58")
            if not secret:
                raise ValueError("Wallet does not contain exportable signing material")
            return str(secret)
        raise KeyError("Wallet not found")

    @staticmethod
    def public_view(wallet: dict[str, Any]) -> dict[str, Any]:
        keys = {
            "id",
            "address",
            "label",
            "group",
            "role",
            "watch_only",
            "cold_storage",
            "signing_enabled",
            "broadcasting_enabled",
            "secret_export_enabled",
            "created_at",
            "notes",
            "tags",
        }
        return {k: wallet.get(k) for k in keys if k in wallet}