from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from .deps import require_session
from ..core.feature_suite import FeatureSuite

router = APIRouter(prefix="/features", tags=["feature-suite"])


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=240)
    color: str = "slate"


class GroupMembers(BaseModel):
    wallet_ids: list[str] = Field(default_factory=list, max_length=500)


class PolicyUpdate(BaseModel):
    require_new_recipient_confirmation: bool | None = None
    require_trusted_recipient: bool | None = None
    recipient_cooldown_minutes: int | None = Field(default=None, ge=0, le=10080)
    per_transaction_limit: str | None = None
    daily_spend_limit: str | None = None
    max_fee_ratio_percent: float | None = Field(default=None, ge=0, le=100)
    require_second_confirmation_above: str | None = None


class TransferRiskCheck(BaseModel):
    network: str
    destination: str = Field(min_length=1, max_length=256)
    amount: str
    fee: str = "0"
    wallet_id: str | None = None


class ScheduledTransferCreate(BaseModel):
    wallet_id: str
    network: str
    destination: str = Field(min_length=1, max_length=256)
    amount: str
    asset: str = "native"
    run_at: str
    recurrence: str = "none"
    memo: str = Field(default="", max_length=240)


class BatchTransferCreate(BaseModel):
    wallet_id: str
    network: str
    transfers: list[dict] = Field(min_length=1, max_length=100)


class CostBasisEntry(BaseModel):
    kind: str
    asset: str
    quantity: str
    unit_price_usd: str = "0"
    fee_usd: str = "0"
    wallet_id: str | None = None
    timestamp: str | None = None
    description: str = Field(default="", max_length=240)


class LimitOrderCreate(BaseModel):
    asset: str = Field(min_length=1, max_length=20)
    side: str
    target_price: str
    quantity: str


class PaymentRequestCreate(BaseModel):
    network: str
    asset: str = "native"
    address: str = Field(min_length=1, max_length=256)
    amount: str
    label: str = Field(default="Payment request", max_length=80)
    memo: str = Field(default="", max_length=240)
    expires_at: str | None = None


class AssistantQuestion(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class MetadataExport(BaseModel):
    passphrase: str = Field(min_length=12, max_length=256)


class MetadataImport(MetadataExport):
    bundle: str = Field(min_length=1, max_length=5_000_000)
    merge: bool = True


class ScheduleCancel(BaseModel):
    confirm: bool = False


@router.get("/status")
async def feature_status(state=Depends(require_session)):
    service = FeatureSuite(state)
    return {
        "wallet_groups": "LIVE",
        "transaction_policies": "LIVE",
        "scheduled_payment_intents": "LIVE_MANUAL_APPROVAL_ONLY",
        "batch_transfer_drafts": "LIVE_DRAFT_ONLY",
        "cost_basis_fifo": "LIVE_USER_ENTERED_LEDGER",
        "payment_requests": "LIVE_TRACKING_DEPENDS_ON_INDEXED_ACTIVITY",
        "explorer_links": "LIVE_EXTERNAL_LINKS",
        "wallet_graph": "PARTIAL_SOLANA_INDEXED_ACTIVITY",
        "local_assistant": "LIVE_READ_ONLY_RULE_BASED",
        "metadata_sync": "LIVE_ENCRYPTED_MANUAL_EXPORT_IMPORT_NO_PRIVATE_KEYS",
        "security_center": "LIVE_LOCAL_VAULT_SCOPE",
        "security_alerts": "LIVE_HEURISTIC_REVIEW_SIGNALS",
        "backup_integrity": "LIVE_SHA256_MANIFEST_VERIFICATION",
        "recovery_checklist": "LIVE_GUIDANCE_ONLY_RESTORE_DRILL_NOT_IMPLEMENTED",
        "network_capability_matrix": "LIVE_STATUS_REPORT",
        "transaction_export": "LIVE_LOCAL_EXECUTION_RECORDS_CSV",
        "exchange_history": "PARTIAL_LOCAL_EXECUTION_RECORDS",
        "cross_chain_swaps": "NOT_IMPLEMENTED",
        "exchange_provider_comparison": "NOT_IMPLEMENTED",
        "hardware_wallets": "NOT_IMPLEMENTED_BY_USER_REQUEST",
        "native_network_adapters": {"solana": "LIVE", "bitcoin": "NOT_IMPLEMENTED", "litecoin": "NOT_IMPLEMENTED", "dogecoin": "NOT_IMPLEMENTED", "monero": "NOT_IMPLEMENTED", "zano": "NOT_IMPLEMENTED", "ethereum-classic": "NOT_IMPLEMENTED", "ravencoin": "NOT_IMPLEMENTED", "ergo": "NOT_IMPLEMENTED", "kaspa": "NOT_IMPLEMENTED"},
        "feature_suite_can_sign": False,
        "feature_suite_can_broadcast": False,
        "fund_movement_authority": False,
    }


@router.get("/wallet-groups")
async def list_wallet_groups(state=Depends(require_session)):
    return FeatureSuite(state).groups()


@router.post("/wallet-groups")
async def create_wallet_group(body: GroupCreate, state=Depends(require_session)):
    try: return FeatureSuite(state).create_group(**body.model_dump())
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.put("/wallet-groups/{group_id}/members")
async def set_wallet_group_members(group_id: str, body: GroupMembers, state=Depends(require_session)):
    try: return FeatureSuite(state).set_group_members(group_id, body.wallet_ids)
    except KeyError as exc: raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/wallet-groups/{group_id}")
async def delete_wallet_group(group_id: str, state=Depends(require_session)):
    try: FeatureSuite(state).delete_group(group_id); return {"deleted": True}
    except KeyError as exc: raise HTTPException(status_code=404, detail=str(exc))


@router.get("/transaction-policy")
async def get_transaction_policy(state=Depends(require_session)):
    return FeatureSuite(state).get_policy()


@router.put("/transaction-policy")
async def update_transaction_policy(body: PolicyUpdate, state=Depends(require_session)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    try: return FeatureSuite(state).set_policy(updates)
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.post("/transactions/evaluate")
async def evaluate_transfer(body: TransferRiskCheck, state=Depends(require_session)):
    try: return FeatureSuite(state).evaluate_transfer(network=body.network, destination=body.destination, value=body.amount, fee=body.fee, wallet_id=body.wallet_id)
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.get("/scheduled-transfers")
async def list_scheduled_transfers(state=Depends(require_session)):
    service = FeatureSuite(state); service.process_due(); return service.schedules()


@router.post("/scheduled-transfers")
async def create_scheduled_transfer(body: ScheduledTransferCreate, state=Depends(require_session)):
    try: return FeatureSuite(state).create_schedule(body.model_dump())
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.post("/scheduled-transfers/{schedule_id}/cancel")
async def cancel_scheduled_transfer(schedule_id: str, body: ScheduleCancel, state=Depends(require_session)):
    if not body.confirm: raise HTTPException(status_code=400, detail="Explicit cancellation confirmation is required")
    try: return FeatureSuite(state).cancel_schedule(schedule_id)
    except KeyError as exc: raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc: raise HTTPException(status_code=409, detail=str(exc))


@router.post("/scheduled-transfers/{schedule_id}/approve")
async def approve_scheduled_transfer(schedule_id: str, body: ScheduleCancel, state=Depends(require_session)):
    if not body.confirm: raise HTTPException(status_code=400, detail="Explicit approval is required")
    try: return FeatureSuite(state).approve_schedule(schedule_id)
    except KeyError as exc: raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc: raise HTTPException(status_code=409, detail=str(exc))


@router.post("/scheduled-transfers/process-due")
async def process_due_scheduled_transfers(state=Depends(require_session)):
    return FeatureSuite(state).process_due()


@router.get("/batches")
async def list_batches(state=Depends(require_session)):
    return FeatureSuite(state).batches()


@router.post("/batches")
async def create_batch(body: BatchTransferCreate, state=Depends(require_session)):
    try: return FeatureSuite(state).create_batch(body.wallet_id, body.network, body.transfers)
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.get("/cost-basis")
async def cost_basis_summary(state=Depends(require_session)):
    return FeatureSuite(state).cost_basis_summary()


@router.get("/cost-basis/entries")
async def cost_basis_entries(state=Depends(require_session)):
    return FeatureSuite(state).ledger_entries()


@router.post("/cost-basis/entries")
async def add_cost_basis_entry(body: CostBasisEntry, state=Depends(require_session)):
    try: return FeatureSuite(state).add_ledger_entry(body.model_dump())
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.get("/cost-basis/export.csv")
async def export_cost_basis(state=Depends(require_session)):
    csv_data = FeatureSuite(state).cost_basis_csv()
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=nexus-cost-basis.csv", "Cache-Control": "no-store"})


@router.get("/limit-orders")
async def list_limit_orders(state=Depends(require_session)):
    service = FeatureSuite(state)
    return {"orders": service.limit_orders(), "execution_enabled": False, "trigger_behavior": "ALERT_AND_REQUIRE_MANUAL_REVIEW"}


@router.post("/limit-orders")
async def create_limit_order(body: LimitOrderCreate, state=Depends(require_session)):
    try: return FeatureSuite(state).create_limit_order(body.model_dump())
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.post("/limit-orders/{order_id}/cancel")
async def cancel_limit_order(order_id: str, body: ScheduleCancel, state=Depends(require_session)):
    if not body.confirm: raise HTTPException(status_code=400, detail="Explicit cancellation confirmation is required")
    try: return FeatureSuite(state).cancel_limit_order(order_id)
    except KeyError as exc: raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc: raise HTTPException(status_code=409, detail=str(exc))


@router.get("/payment-requests")
async def list_payment_requests(state=Depends(require_session)):
    return FeatureSuite(state).payment_requests()


@router.post("/payment-requests")
async def create_payment_request(body: PaymentRequestCreate, state=Depends(require_session)):
    try: return FeatureSuite(state).create_payment_request(body.model_dump())
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.get("/explorer/{network}/{kind}/{identifier}")
async def explorer_link(network: str, kind: str, identifier: str, state=Depends(require_session)):
    try: return FeatureSuite(state).explorer_url(network, kind, identifier)
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.get("/wallet-graph")
async def wallet_graph(state=Depends(require_session)):
    return FeatureSuite(state).wallet_graph()


@router.post("/assistant/query")
async def assistant_query(body: AssistantQuestion, state=Depends(require_session)):
    try: return FeatureSuite(state).assistant(body.query)
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.get("/fees")
async def list_fee_quotes(network: str | None = None, state=Depends(require_session)):
    rows = FeatureSuite(state).fee_quotes(network)
    now = datetime.now(timezone.utc)
    for row in rows:
        try: row["fresh"] = datetime.fromisoformat(row["expires_at"]) > now
        except (KeyError, ValueError): row["fresh"] = False
    return {"quotes": rows, "status": "AVAILABLE" if any(x["fresh"] for x in rows) else "NO_CURRENT_PROVIDER_QUOTE", "no_fallback_estimates_invented": True}


@router.get("/portfolio-analytics")
async def portfolio_analytics(state=Depends(require_session)):
    return FeatureSuite(state).portfolio_analytics()


@router.get("/security-center")
async def security_center(state=Depends(require_session)):
    return FeatureSuite(state).security_summary()


@router.get("/security-alerts")
async def security_alerts(state=Depends(require_session)):
    return FeatureSuite(state).security_alerts()


@router.post("/security-alerts/{alert_id}/acknowledge")
async def acknowledge_security_alert(alert_id: str, body: ScheduleCancel, state=Depends(require_session)):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Explicit acknowledgement is required")
    try: return FeatureSuite(state).acknowledge_security_alert(alert_id)
    except KeyError as exc: raise HTTPException(status_code=404, detail=str(exc))


@router.get("/recovery-checklist")
async def recovery_checklist(state=Depends(require_session)):
    return FeatureSuite(state).recovery_checklist()


@router.get("/backups/inventory")
async def backup_inventory(verify_hashes: bool = False, state=Depends(require_session)):
    # Hash verification reads only files in this vault's own backups directory.
    return {"backups": FeatureSuite(state).backup_inventory(verify_hashes), "hashes_checked": verify_hashes,
            "restore_tested": False}


@router.get("/network-capabilities")
async def network_capabilities(state=Depends(require_session)):
    return FeatureSuite(state).network_capabilities()


@router.get("/exchange-history")
async def exchange_history(state=Depends(require_session)):
    return {"items": FeatureSuite(state).exchange_history(), "scope": "locally_recorded_execution_records",
            "cross_chain_swap_support": False}


@router.get("/transactions/export.csv")
async def export_transactions(state=Depends(require_session)):
    csv_data = FeatureSuite(state).execution_history_csv()
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=nexus-transactions.csv", "Cache-Control": "no-store"})


@router.get("/audit-log")
async def audit_log(limit: int = 100, state=Depends(require_session)):
    rows = state.vault.data().setdefault("security_events", [])
    return list(reversed(rows[-max(1, min(limit, 500)):]))


@router.post("/metadata-sync/export")
async def export_metadata(body: MetadataExport, state=Depends(require_session)):
    try: return {"bundle": FeatureSuite(state).export_metadata(body.passphrase), "format": "nexus-metadata-sync-v1", "includes_private_keys": False}
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.post("/metadata-sync/import")
async def import_metadata(body: MetadataImport, state=Depends(require_session)):
    try: return FeatureSuite(state).import_metadata(body.bundle, body.passphrase, body.merge)
    except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))


@router.get("/devices")
async def list_devices(state=Depends(require_session)):
    # Session tokens are never exposed. Sessions are process-local and disappear on restart.
    return {"devices": [{"id": s.session_id, "name": s.device_name, "created_at": s.created_at.isoformat(),
                         "last_seen": s.last_seen.isoformat(), "expires_at": s.expires_at.isoformat(), "current_process": True}
                        for s in state.sessions.values()],
            "scope": "process_local_sessions_only", "remote_device_revocation": False}


@router.delete("/devices/{session_id}")
async def revoke_device_session(session_id: str, state=Depends(require_session)):
    target = next((token for token, session in state.sessions.items() if session.session_id == session_id), None)
    if target is None: raise HTTPException(status_code=404, detail="Session not found")
    state.sessions.pop(target, None)
    if state.vault.unlocked:
        rows = state.vault.data().setdefault("security_events", [])
        rows.append({"id": secrets.token_hex(10), "action": "session.revoked", "subject": session_id, "details": {}, "created_at": datetime.now(timezone.utc).isoformat()})
        state.vault.save()
    return {"revoked": True, "session_id": session_id}


@router.get("/backup-policy")
async def get_backup_policy(state=Depends(require_session)):
    settings = state.vault.data().setdefault("settings", {})
    return {"automatic_backups_enabled": bool(settings.get("automatic_backups_enabled", False)),
            "interval_hours": int(settings.get("automatic_backup_interval_hours", 24)),
            "retention_count": int(settings.get("automatic_backup_retention_count", 14))}


class BackupPolicyUpdate(BaseModel):
    automatic_backups_enabled: bool
    interval_hours: int = Field(default=24, ge=1, le=720)
    retention_count: int = Field(default=14, ge=1, le=100)


@router.put("/backup-policy")
async def set_backup_policy(body: BackupPolicyUpdate, state=Depends(require_session)):
    settings = state.vault.data().setdefault("settings", {})
    settings.update({"automatic_backups_enabled": body.automatic_backups_enabled,
                     "automatic_backup_interval_hours": body.interval_hours,
                     "automatic_backup_retention_count": body.retention_count})
    state.vault.save()
    return body.model_dump()