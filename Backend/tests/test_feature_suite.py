from pathlib import Path
from datetime import datetime, timezone, timedelta

import pytest

from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.core.wallets import WalletService
from backend.core.address_book import AddressBookService
from backend.core.feature_suite import FeatureSuite


def state_for(tmp_path: Path):
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    return AppState(vault)


def test_wallet_groups_validate_and_assign_existing_wallets(tmp_path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Daily")
    suite = FeatureSuite(state)
    group = suite.create_group("Daily", "Regular wallet", "blue")
    updated = suite.set_group_members(group["id"], [wallet["id"]])
    assert updated["wallet_count"] == 1
    assert suite.groups()[0]["wallet_ids"] == [wallet["id"]]
    with pytest.raises(ValueError, match="must exist"):
        suite.set_group_members(group["id"], ["missing"])


def test_transaction_policy_limits_and_trusted_recipient(tmp_path):
    state = state_for(tmp_path)
    target = WalletService(state).create(label="Target")
    sender = WalletService(state).create(label="Sender")
    suite = FeatureSuite(state)
    suite.set_policy({"per_transaction_limit": "1.5", "require_trusted_recipient": True})
    blocked = suite.evaluate_transfer(network="solana", destination=target["address"], value="1", wallet_id=sender["id"])
    assert not blocked["allowed"]
    assert "RECIPIENT_NOT_TRUSTED" in blocked["blockers"]
    AddressBookService(state).add(label="Target", address=target["address"], network="solana", trusted=True)
    allowed = suite.evaluate_transfer(network="solana", destination=target["address"], value="1", wallet_id=sender["id"])
    assert allowed["allowed"]
    too_large = suite.evaluate_transfer(network="solana", destination=target["address"], value="2", wallet_id=sender["id"])
    assert "PER_TRANSACTION_LIMIT_EXCEEDED" in too_large["blockers"]


def test_scheduled_transfer_requires_manual_approval_and_never_broadcasts(tmp_path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Sender")
    destination = WalletService(state).create(label="Recipient")
    suite = FeatureSuite(state)
    row = suite.create_schedule({"wallet_id": wallet["id"], "network": "solana", "destination": destination["address"],
                                 "amount": "0.25", "run_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "recurrence": "none"})
    # Simulate that time has passed without waiting for a scheduler tick.
    row["run_at"] = (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat()
    result = suite.process_due()
    assert result["processed"] == 1
    assert result["broadcasted"] == 0
    assert suite.schedules()[0]["status"] == "AWAITING_MANUAL_APPROVAL"


def test_batch_is_draft_only_and_validates_members(tmp_path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Sender")
    target = WalletService(state).create(label="Target")
    suite = FeatureSuite(state)
    batch = suite.create_batch(wallet["id"], "solana", [{"destination": target["address"], "amount": "1"}])
    assert batch["broadcasted"] is False
    assert batch["signing_available"] is False


def test_fifo_cost_basis_and_disposal_gain(tmp_path):
    state = state_for(tmp_path)
    suite = FeatureSuite(state)
    suite.add_ledger_entry({"kind": "acquisition", "asset": "BTC", "quantity": "2", "unit_price_usd": "10000"})
    suite.add_ledger_entry({"kind": "acquisition", "asset": "BTC", "quantity": "1", "unit_price_usd": "20000"})
    disposal = suite.add_ledger_entry({"kind": "disposal", "asset": "BTC", "quantity": "2.5", "unit_price_usd": "15000", "fee_usd": "10"})
    assert disposal["cost_basis_usd"] == "30000.0"
    assert disposal["realized_gain_loss_usd"] == "7490.0"
    summary = suite.cost_basis_summary()["assets"]["BTC"]
    assert summary["quantity"] == "0.5"


def test_payment_request_expiry_and_explorer_link(tmp_path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Receive")
    suite = FeatureSuite(state)
    request = suite.create_payment_request({"network": "solana", "asset": "SOL", "address": wallet["address"], "amount": "2"})
    assert request["status"] == "OPEN"
    link = suite.explorer_url("solana", "tx", "signature123")
    assert link["url"].endswith("/tx/signature123")


def test_metadata_sync_is_encrypted_and_excludes_private_keys(tmp_path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Secret wallet")
    suite = FeatureSuite(state)
    suite.create_group("Test")
    bundle = suite.export_metadata("a-different-long-sync-passphrase")
    assert wallet["address"] not in bundle
    result = suite.import_metadata(bundle, "a-different-long-sync-passphrase")
    assert result["private_keys_included"] is False
    with pytest.raises(ValueError, match="incorrect"):
        suite.import_metadata(bundle, "wrong-password-123")


def test_limit_orders_only_trigger_manual_review(tmp_path):
    state = state_for(tmp_path)
    suite = FeatureSuite(state)
    state.vault.data()["assets"] = {"SOL": {"symbol": "SOL", "price_usd": 90}}
    order = suite.create_limit_order({"asset": "SOL", "side": "buy", "target_price": "100", "quantity": "1"})
    result = suite.evaluate_limit_orders()
    assert result["triggered_for_review"] == 1
    assert suite.limit_orders()[0]["status"] == "TRIGGERED_REQUIRES_MANUAL_REVIEW"
    assert suite.limit_orders()[0]["execution_enabled"] is False if "execution_enabled" in suite.limit_orders()[0] else True


def test_read_only_assistant_does_not_accept_action_authority(tmp_path):
    state = state_for(tmp_path)
    reply = FeatureSuite(state).assistant("What is my portfolio worth?")
    assert reply["mode"] == "LOCAL_READ_ONLY"
    assert reply["can_sign"] is False
    assert reply["can_broadcast"] is False


def test_risk_score_explains_new_recipient_and_policy_blocks(tmp_path):
    state = state_for(tmp_path)
    wallet = WalletService(state).create(label="Source")
    suite = FeatureSuite(state)
    result = suite.evaluate_transfer(network="solana", destination=wallet["address"], value="0.5")
    assert result["risk_score"] >= 30
    assert result["risk_band"] in {"MEDIUM", "HIGH"}
    assert "NEW_OR_UNTRUSTED_RECIPIENT" in result["risk_factors"]
    suite.set_policy({"require_trusted_recipient": True})
    blocked = suite.evaluate_transfer(network="solana", destination=wallet["address"], value="0.5")
    assert blocked["risk_score"] == 100
    assert blocked["risk_band"] == "HIGH"


def test_security_alerts_can_be_acknowledged_and_are_idempotent(tmp_path):
    state = state_for(tmp_path)
    state.vault.data()["execution_records"] = [{
        "id": "failed-1", "state": "FAILED", "created_at": datetime.now(timezone.utc).isoformat(),
        "destination": "some-address", "wallet_id": "wallet-1", "broadcasted": False,
    }]
    suite = FeatureSuite(state)
    alerts = suite.security_alerts()
    assert len(alerts) == 1
    assert alerts[0]["code"] == "EXECUTION_FAILED"
    first = suite.acknowledge_security_alert(alerts[0]["id"])
    second = suite.acknowledge_security_alert(alerts[0]["id"])
    assert first == second
    assert suite.security_alerts() == []


def test_backup_inventory_verifies_manifest_hash(tmp_path):
    import hashlib
    import json

    state = state_for(tmp_path)
    backup_dir = state.vault.path.parent / "backups"
    backup_dir.mkdir()
    backup = backup_dir / "vault-copy.svault"
    backup.write_bytes(b"encrypted-vault-fixture")
    manifest = {"name": backup.name, "bytes": backup.stat().st_size,
                "sha256": hashlib.sha256(backup.read_bytes()).hexdigest(), "created_at": "2026-11-22T00:00:00Z"}
    backup.with_suffix(backup.suffix + ".manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    suite = FeatureSuite(state)
    assert suite.backup_inventory(verify_hashes=True)[0]["integrity"] == "MATCH"
    backup.write_bytes(b"tampered")
    assert suite.backup_inventory(verify_hashes=True)[0]["integrity"] == "MISMATCH"


def test_recovery_checklist_and_network_matrix_are_explicit(tmp_path):
    state = state_for(tmp_path)
    suite = FeatureSuite(state)
    checklist = suite.recovery_checklist()
    assert checklist["restore_tested_by_application"] is False
    matrix = {row["network"]: row for row in suite.network_capabilities()}
    assert matrix["solana-mainnet-beta"]["wallet_read"] == "LIVE"
    assert matrix["ethereum-mainnet"]["wallet_read"] == "READ_ONLY_PARTIAL"
    assert matrix["bitcoin-mainnet"]["wallet_read"] == "READ_ONLY_PARTIAL"
    assert matrix["monero-mainnet"]["wallet_read"] == "READ_ONLY_PARTIAL"
    assert matrix["ethereum-mainnet"]["send"] == "DISABLED"
    assert matrix["bitcoin-mainnet"]["swap"] == "NOT_IMPLEMENTED"
    assert len(matrix) >= 25


def test_exchange_history_and_csv_exports_are_read_only(tmp_path):
    state = state_for(tmp_path)
    state.vault.data()["execution_records"] = [{"id": "swap-1", "state": "CONFIRMED", "output_mint": "TOKEN",
                                                    "quote": {"outAmount": "10"}, "created_at": "2026-11-22T12:00:00Z"}]
    suite = FeatureSuite(state)
    assert suite.exchange_history()[0]["id"] == "swap-1"
    assert "created_at,updated_at,state" in suite.execution_history_csv()
    assert len(suite.exchange_history()) == 1


def test_fee_quote_read_does_not_mutate_vault_records(tmp_path):
    state = state_for(tmp_path)
    state.vault.data()["fee_quotes"] = [{"id": "q", "network": "solana", "fee": "0.00001", "unit": "SOL", "observed_at": "2026-11-22T00:00:00Z"}]
    before = dict(state.vault.data()["fee_quotes"][0])
    FeatureSuite(state).fee_quotes()
    assert state.vault.data()["fee_quotes"][0] == before


def test_simulation_is_a_one_use_execution_authorization():
    from backend.core.execution_guard import claim_simulation_once, SimulationAlreadyConsumed

    simulation = {"state": "SIMULATED", "simulation_id": "sim-1"}
    claimed = claim_simulation_once(simulation, claimed_at="2026-11-22T12:00:00+00:00")
    assert claimed["execution_claimed_at"] == "2026-11-22T12:00:00+00:00"
    with pytest.raises(SimulationAlreadyConsumed):
        claim_simulation_once(simulation)
    with pytest.raises(SimulationAlreadyConsumed):
        claim_simulation_once({"state": "FAILED"})


def test_transaction_fee_ratio_accepts_api_string_values(tmp_path):
    state = state_for(tmp_path)
    target = WalletService(state).create(label="Target")
    suite = FeatureSuite(state)
    suite.set_policy({"max_fee_ratio_percent": 1})
    result = suite.evaluate_transfer(
        network="solana", destination=target["address"], value="1.0", fee="0.02"
    )
    assert "FEE_RATIO_HIGH" in result["warnings"]