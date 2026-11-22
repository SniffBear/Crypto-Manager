from __future__ import annotations

import base64
import hashlib
import json
import secrets
from datetime import datetime, timezone
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from .wallets import b58decode


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def proposal_digest(proposal: dict[str, Any]) -> bytes:
    payload = {
        "id": proposal["id"],
        "wallet_id": proposal["wallet_id"],
        "transaction": proposal["transaction"],
        "created_at": proposal["created_at"],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical).digest()


class MultisigService:
    def __init__(self, state) -> None:
        self.state = state

    def wallets(self) -> list[dict[str, Any]]:
        return self.state.vault.data().setdefault("multisig_wallets", [])

    def proposals(self) -> list[dict[str, Any]]:
        return self.state.vault.data().setdefault("multisig_proposals", [])

    def create_wallet(
        self,
        *,
        name: str,
        members: list[str],
        threshold: int,
    ) -> dict[str, Any]:
        unique_members = list(dict.fromkeys(members))
        if not unique_members:
            raise ValueError("At least one multisig member is required")
        if threshold < 1 or threshold > len(unique_members):
            raise ValueError("Threshold must be between 1 and member count")
        item = {
            "id": secrets.token_hex(8),
            "name": name,
            "members": unique_members,
            "threshold": threshold,
            "created_at": now_iso(),
        }
        self.wallets().append(item)
        self.state.vault.save()
        return item

    def create_proposal(
        self,
        *,
        multisig_id: str,
        wallet_id: str,
        transaction: dict[str, Any],
    ) -> dict[str, Any]:
        config = next((item for item in self.wallets() if item["id"] == multisig_id), None)
        if not config:
            raise KeyError("Multisig wallet not found")
        proposal = {
            "id": secrets.token_hex(8),
            "multisig_id": multisig_id,
            "wallet_id": wallet_id,
            "transaction": transaction,
            "created_at": now_iso(),
            "status": "AWAITING_SIGNATURES",
            "approvals": [],
        }
        proposal["digest"] = base64.b64encode(proposal_digest(proposal)).decode("ascii")
        self.proposals().append(proposal)
        self.state.vault.save()
        return proposal

    def approve(
        self,
        *,
        proposal_id: str,
        member: str,
        signature_b58: str,
    ) -> dict[str, Any]:
        proposal = next((item for item in self.proposals() if item["id"] == proposal_id), None)
        if not proposal:
            raise KeyError("Multisig proposal not found")
        config = next(
            (item for item in self.wallets() if item["id"] == proposal["multisig_id"]),
            None,
        )
        if not config:
            raise KeyError("Multisig wallet not found")
        if member not in config["members"]:
            raise ValueError("Member is not authorized for this proposal")
        if any(item["member"] == member for item in proposal["approvals"]):
            raise ValueError("Member has already approved this proposal")

        digest = proposal_digest(proposal)
        try:
            public_key = Ed25519PublicKey.from_public_bytes(b58decode(member))
            signature = b58decode(signature_b58)
            public_key.verify(signature, digest)
        except Exception as exc:
            raise ValueError("Invalid member signature") from exc

        proposal["approvals"].append(
            {
                "member": member,
                "signature": signature_b58,
                "approved_at": now_iso(),
            }
        )
        if len(proposal["approvals"]) >= int(config["threshold"]):
            proposal["status"] = "READY"
        self.state.vault.save()
        return proposal