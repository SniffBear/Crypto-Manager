from __future__ import annotations

import base64
import json
import os
import secrets
import time
from pathlib import Path
from threading import RLock
from typing import Any

from argon2.low_level import Type, hash_secret_raw
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

FORMAT_VERSION = 2
LEGACY_FORMAT_VERSION = 1
PBKDF2_ITERATIONS = 600_000
ARGON2_MEMORY_KIB = 64 * 1024
ARGON2_TIME_COST = 3
ARGON2_PARALLELISM = 1
SALT_LEN = 16
NONCE_LEN = 12
CURRENT_KDF = "Argon2id"


class VaultError(RuntimeError):
    pass


def _derive_pbkdf2(password: str | bytes | bytearray, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(bytes(password, "utf-8") if isinstance(password, str) else bytes(password))


def _derive_argon2id(password: str | bytes | bytearray, salt: bytes) -> bytes:
    raw_password = password.encode("utf-8") if isinstance(password, str) else bytes(password)
    return hash_secret_raw(
        secret=raw_password,
        salt=salt,
        time_cost=ARGON2_TIME_COST,
        memory_cost=ARGON2_MEMORY_KIB,
        parallelism=ARGON2_PARALLELISM,
        hash_len=32,
        type=Type.ID,
    )


def _derive_key(
    password: str | bytes | bytearray,
    salt: bytes,
    *,
    kdf_name: str = CURRENT_KDF,
) -> bytes:
    if kdf_name == CURRENT_KDF:
        return _derive_argon2id(password, salt)
    if kdf_name == "PBKDF2-HMAC-SHA256":
        return _derive_pbkdf2(password, salt)
    raise VaultError("Unsupported vault key derivation function")


def _encrypt_payload(payload: dict[str, Any], password: str | bytes | bytearray) -> bytes:
    salt = os.urandom(SALT_LEN)
    nonce = os.urandom(NONCE_LEN)
    key = _derive_key(password, salt)
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    aad = f"solana-vault:{FORMAT_VERSION}".encode()
    ciphertext = AESGCM(key).encrypt(nonce, raw, aad)
    envelope = {
        "format": FORMAT_VERSION,
        "kdf": CURRENT_KDF,
        "memory_kib": ARGON2_MEMORY_KIB,
        "time_cost": ARGON2_TIME_COST,
        "parallelism": ARGON2_PARALLELISM,
        "salt": base64.b64encode(salt).decode(),
        "nonce": base64.b64encode(nonce).decode(),
        "ciphertext": base64.b64encode(ciphertext).decode(),
    }
    return json.dumps(envelope, indent=2).encode("utf-8")


def _decrypt_payload(blob: bytes, password: str | bytes | bytearray) -> tuple[dict[str, Any], int]:
    try:
        envelope = json.loads(blob.decode("utf-8"))
        format_version = int(envelope.get("format", LEGACY_FORMAT_VERSION))
        if format_version not in {LEGACY_FORMAT_VERSION, FORMAT_VERSION}:
            raise VaultError("Unsupported vault format")

        salt = base64.b64decode(envelope["salt"])
        nonce = base64.b64decode(envelope["nonce"])
        ciphertext = base64.b64decode(envelope["ciphertext"])
        kdf_name = envelope.get("kdf", "PBKDF2-HMAC-SHA256")
        key = _derive_key(password, salt, kdf_name=kdf_name)

        aad = f"solana-vault:{format_version}".encode()
        raw = AESGCM(key).decrypt(nonce, ciphertext, aad)
        payload = json.loads(raw.decode("utf-8"))
        if not isinstance(payload, dict):
            raise VaultError("Vault payload is invalid")
        return payload, format_version
    except VaultError:
        raise
    except Exception as exc:
        raise VaultError("Invalid password or corrupted vault") from exc


def _clear_secret(value: bytearray | None) -> None:
    if value is None:
        return
    for index in range(len(value)):
        value[index] = 0


class VaultManager:
    """Encrypted on-disk vault with an in-memory unlocked payload."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._unlocked = False
        self._password: bytearray | None = None
        self._payload: dict[str, Any] | None = None
        self._unlocked_at: float | None = None
        self._kdf_migrated = False

    @property
    def exists(self) -> bool:
        return self.path.exists()

    @property
    def unlocked(self) -> bool:
        return self._unlocked

    @property
    def unlocked_at(self) -> float | None:
        return self._unlocked_at

    @property
    def kdf_migrated(self) -> bool:
        return self._kdf_migrated

    def create(self, password: str) -> None:
        if self.exists:
            raise VaultError("Vault already exists")
        if len(password) < 10:
            raise VaultError("Vault password must be at least 10 characters")
        payload = {
            "version": 2,
            "created_at": int(time.time()),
            "wallets": [],
            "assets": {},
            "activity": [],
            "portfolio_snapshots": [],
            "alerts": [],
            "watchlists": [],
            "strategies": [],
            "accounting": [],
            "providers": {},
            "rpc": {"networks": []},
            "settings": {},
            "address_book": [],
            "wallet_groups": [],
            "scheduled_transfers": [],
            "batch_transfers": [],
            "cost_basis_lots": [],
            "cost_basis_events": [],
            "payment_requests": [],
            "fee_quotes": [],
            "limit_orders": [],
            "security_events": [],
        }
        with self._lock:
            self._atomic_write(payload, password)
            self._payload = payload
            self._password = bytearray(password.encode("utf-8"))
            self._unlocked = True
            self._unlocked_at = time.time()
            self._kdf_migrated = True

    def unlock(self, password: str) -> None:
        if not self.exists:
            raise VaultError("Vault does not exist")
        blob = self.path.read_bytes()
        payload, format_version = _decrypt_payload(blob, password)
        with self._lock:
            self._payload = payload
            _clear_secret(self._password)
            self._password = bytearray(password.encode("utf-8"))
            self._unlocked = True
            self._unlocked_at = time.time()
            self._kdf_migrated = format_version == FORMAT_VERSION
            if format_version == LEGACY_FORMAT_VERSION:
                # Successful legacy unlock immediately upgrades the encrypted
                # envelope; the payload itself remains backward-compatible.
                self._atomic_write(payload, password)
                self._kdf_migrated = True

    @staticmethod
    def validate_blob(blob: bytes, password: str) -> dict[str, Any]:
        payload, _ = _decrypt_payload(blob, password)
        return payload

    def verify_password(self, password: str) -> bool:
        if not self.exists:
            return False
        try:
            self.validate_blob(self.path.read_bytes(), password)
            return True
        except VaultError:
            return False

    def lock(self) -> None:
        with self._lock:
            self._payload = None
            _clear_secret(self._password)
            self._password = None
            self._unlocked = False
            self._unlocked_at = None
            self._kdf_migrated = False

    def require_unlocked(self) -> dict[str, Any]:
        if not self._unlocked or self._payload is None:
            raise VaultError("Vault is locked")
        return self._payload

    def data(self) -> dict[str, Any]:
        return self.require_unlocked()

    def save(self) -> None:
        with self._lock:
            payload = self.require_unlocked()
            if self._password is None:
                raise VaultError("Vault password is unavailable")
            self._atomic_write(payload, bytes(self._password))

    def _atomic_write(self, payload: dict[str, Any], password: str | bytes | bytearray) -> None:
        encrypted = _encrypt_payload(payload, password)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_bytes(encrypted)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, self.path)
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass

    def export_copy(self, destination: str | Path) -> Path:
        if not self.exists:
            raise VaultError("Vault does not exist")
        destination = Path(destination)
        if destination.resolve() == self.path.resolve():
            raise VaultError("Backup destination must differ from the active vault")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(self.path.read_bytes())
        try:
            os.chmod(destination, 0o600)
        except OSError:
            pass
        return destination

    def metadata(self) -> dict[str, Any]:
        return {
            "exists": self.exists,
            "locked": not self.unlocked,
            "unlocked_at": self.unlocked_at,
            "path": str(self.path),
            "format_version": FORMAT_VERSION,
            "kdf": CURRENT_KDF,
            "iterations": PBKDF2_ITERATIONS,
            "argon2_memory_kib": ARGON2_MEMORY_KIB,
            "argon2_time_cost": ARGON2_TIME_COST,
            "argon2_parallelism": ARGON2_PARALLELISM,
            "kdf_migrated": self.kdf_migrated,
        }


__all__ = [
    "VaultManager",
    "VaultError",
    "FORMAT_VERSION",
    "PBKDF2_ITERATIONS",
    "CURRENT_KDF",
    "ARGON2_MEMORY_KIB",
    "ARGON2_TIME_COST",
    "ARGON2_PARALLELISM",
]