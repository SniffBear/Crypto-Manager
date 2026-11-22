from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from backend.core.multisig import MultisigService, proposal_digest
from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.core.wallets import b58encode


def test_multisig_approval_reaches_threshold(tmp_path: Path):
    vm = VaultManager(tmp_path / "vault.svault")
    vm.create("a-very-strong-password")
    state = AppState(vm)
    svc = MultisigService(state)

    key = Ed25519PrivateKey.generate()
    public = key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    member = b58encode(public)

    config = svc.create_wallet(name="Treasury", members=[member], threshold=1)
    proposal = svc.create_proposal(
        multisig_id=config["id"],
        wallet_id="wallet-1",
        transaction={"type": "transfer", "amount": 1},
    )
    signature = key.sign(proposal_digest(proposal))
    approved = svc.approve(
        proposal_id=proposal["id"],
        member=member,
        signature_b58=b58encode(signature),
    )

    assert approved["status"] == "READY"
    assert len(approved["approvals"]) == 1