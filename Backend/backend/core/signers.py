from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

from solders.keypair import Keypair
from solders.message import to_bytes_versioned
from solders.signature import Signature
from solders.transaction import VersionedTransaction

from .wallets import b58decode


class TransactionSigner(Protocol):
    wallet_id: str

    def sign_message(self, message: bytes) -> bytes:
        ...

    def sign_versioned(self, transaction: VersionedTransaction) -> VersionedTransaction:
        ...


@dataclass
class LocalKeypairSigner:
    wallet_id: str
    keypair: Keypair

    def sign_message(self, message: bytes) -> bytes:
        return bytes(self.keypair.sign_message(message))

    def sign_versioned(self, transaction: VersionedTransaction) -> VersionedTransaction:
        signature = self.keypair.sign_message(to_bytes_versioned(transaction.message))
        return VersionedTransaction.populate(
            transaction.message,
            [Signature.from_bytes(bytes(signature))],
        )


class HardwareSignerUnavailable:
    """Interface placeholder for a future Ledger/remote signer implementation."""

    def __init__(self, wallet_id: str) -> None:
        self.wallet_id = wallet_id

    def sign_message(self, message: bytes) -> bytes:
        raise RuntimeError("Hardware signer is not configured")

    def sign_versioned(self, transaction: VersionedTransaction) -> VersionedTransaction:
        raise RuntimeError("Hardware signer is not configured")


def local_signer_from_wallet(wallet: dict) -> LocalKeypairSigner:
    secret = wallet.get("secret_key_b58")
    if not secret:
        raise RuntimeError("Wallet has no local signing material")
    raw = b58decode(str(secret))
    if len(raw) != 64:
        raise RuntimeError("Stored wallet key material is invalid")
    return LocalKeypairSigner(
        wallet_id=str(wallet["id"]),
        keypair=Keypair.from_bytes(raw),
    )


def live_execution_enabled() -> bool:
    return os.getenv("ENABLE_LIVE_EXECUTION", "false").lower() in {"1", "true", "yes"}