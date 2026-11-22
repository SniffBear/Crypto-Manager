from __future__ import annotations

import asyncio
import base64
import os
import secrets
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from solders.hash import Hash
from solders.instruction import AccountMeta, Instruction
from solders.message import MessageV0, to_bytes_versioned
from solders.signature import Signature
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import VersionedTransaction

from .deps import require_session
from ..core.signers import local_signer_from_wallet, live_execution_enabled
from ..providers.registry import ProviderRegistry
from ..solana.client import SolanaRPCClient
from ..sync.service import SyncService
from ..core.address_book import AddressBookService
from ..core.execution_guard import claim_simulation_once, SimulationAlreadyConsumed

router = APIRouter(prefix="/execution", tags=["execution"])


class ExecutionState(str, Enum):
    CREATED = "CREATED"
    QUOTED = "QUOTED"
    BUILT = "BUILT"
    SIMULATED = "SIMULATED"
    AWAITING_SIGNER = "AWAITING_SIGNER"
    SIGNED = "SIGNED"
    BROADCASTED = "BROADCASTED"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"
    ADAPTER_UNAVAILABLE = "ADAPTER_UNAVAILABLE"


class SimulateTransfer(BaseModel):
    wallet_id: str
    destination: str
    amount: float = Field(gt=0)
    asset_mint: str | None = None


class ExecuteTransfer(SimulateTransfer):
    confirm: bool = False
    confirm_new_recipient: bool = False
    confirm_risk_warnings: bool = False
    simulation_id: str | None = None


class SwapQuoteRequest(BaseModel):
    wallet_id: str
    input_mint: str
    output_mint: str
    amount: int = Field(gt=0)
    slippage_bps: int = Field(default=50, ge=1, le=5000)


class SwapExecuteRequest(SwapQuoteRequest):
    confirm: bool = False


def _record(state, data: dict) -> dict:
    records = state.vault.data().setdefault("execution_records", [])
    records.append(data)
    state.vault.save()
    return data


def _update_record(state, record: dict, **changes: Any) -> dict:
    record.update(changes)
    record["updated_at"] = datetime.now(timezone.utc).isoformat()
    state.vault.save()
    return record


def _new_record(
    *,
    wallet_id: str,
    destination: str | None,
    amount: float | int | None,
    asset_mint: str | None,
    state_value: ExecutionState,
    reason: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": secrets.token_hex(8),
        "state": state_value.value,
        "wallet_id": wallet_id,
        "destination": destination,
        "amount": amount,
        "asset_mint": asset_mint,
        "created_at": now,
        "updated_at": now,
        "reason": reason,
        "broadcasted": False,
        "confirmed": False,
    }


def _get_wallet(state, wallet_id: str) -> dict:
    wallet = next(
        (w for w in state.vault.data().get("wallets", []) if w.get("id") == wallet_id),
        None,
    )
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet


def _solana_client(state) -> SolanaRPCClient:
    return SyncService(state).client()


TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
TOKEN_2022_PROGRAM_ID = Pubkey.from_string("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTjQqM8F3")
SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")


def _token_holding(state, wallet_id: str, mint: str) -> tuple[dict[str, Any], dict[str, Any]]:
    asset = state.vault.data().get("assets", {}).get(mint)
    if not asset:
        raise HTTPException(status_code=404, detail="Token asset not found in vault state")
    holding = asset.get("holdings", {}).get(wallet_id)
    if not holding:
        raise HTTPException(status_code=409, detail="Wallet does not have a synchronized holding for this token")
    source_account = holding.get("token_account")
    if not source_account:
        raise HTTPException(status_code=409, detail="Source token account is unavailable")
    extensions = holding.get("token_2022_extensions") or {}
    unsupported_for_execution = {
        "transferHook",
        "confidentialTransferMint",
        "confidentialTransferFeeConfig",
        "pausable",
        "nonTransferable",
    }
    if extensions.get("has_unsupported_extensions") or any(
        item in unsupported_for_execution
        for item in extensions.get("extension_types", [])
    ):
        raise HTTPException(
            status_code=409,
            detail="This Token-2022 holding uses an extension the execution layer does not support safely.",
        )
    return asset, holding


def _associated_token_address(owner: Pubkey, mint: Pubkey, token_program: Pubkey) -> Pubkey:
    address, _ = Pubkey.find_program_address(
        [bytes(owner), bytes(token_program), bytes(mint)],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    return address


def _create_associated_token_instruction(
    payer: Pubkey,
    ata: Pubkey,
    owner: Pubkey,
    mint: Pubkey,
    token_program: Pubkey,
) -> Instruction:
    return Instruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        b"",
        [
            AccountMeta(payer, True, True),
            AccountMeta(ata, False, True),
            AccountMeta(owner, False, False),
            AccountMeta(mint, False, False),
            AccountMeta(SYSTEM_PROGRAM_ID, False, False),
            AccountMeta(token_program, False, False),
        ],
    )


def _token_transfer_instruction(
    source: Pubkey,
    mint: Pubkey,
    destination: Pubkey,
    owner: Pubkey,
    token_program: Pubkey,
    raw_amount: int,
    decimals: int,
) -> Instruction:
    if raw_amount <= 0:
        raise HTTPException(status_code=400, detail="Token transfer amount must be positive")
    if decimals < 0 or decimals > 255:
        raise HTTPException(status_code=400, detail="Invalid token decimals")
    data = bytes([12]) + raw_amount.to_bytes(8, "little") + bytes([decimals])
    return Instruction(
        token_program,
        data,
        [
            AccountMeta(source, False, True),
            AccountMeta(mint, False, False),
            AccountMeta(destination, False, True),
            AccountMeta(owner, True, False),
        ],
    )


async def _build_transfer_message(
    client: SolanaRPCClient,
    state,
    wallet: dict[str, Any],
    body: SimulateTransfer,
) -> tuple[MessageV0, dict[str, Any]]:
    source_owner = Pubkey.from_string(wallet["address"])
    destination_owner = Pubkey.from_string(body.destination)
    blockhash = await client.get_latest_blockhash()
    instructions: list[Instruction] = []

    if body.asset_mint:
        asset, holding = _token_holding(state, body.wallet_id, body.asset_mint)
        mint = Pubkey.from_string(body.asset_mint)
        source = Pubkey.from_string(str(holding["token_account"]))
        token_program_value = holding.get("token_program") or asset.get("program")
        token_program = (
            Pubkey.from_string(token_program_value)
            if token_program_value
            else TOKEN_PROGRAM_ID
        )
        decimals = int(holding.get("decimals") if holding.get("decimals") is not None else asset.get("decimals") or 0)
        raw_amount = int(round(float(body.amount) * (10 ** decimals)))
        destination_ata = _associated_token_address(destination_owner, mint, token_program)
        destination_info = await client.get_account_info(str(destination_ata))
        if not destination_info or destination_info.get("value") is None:
            instructions.append(
                _create_associated_token_instruction(
                    source_owner,
                    destination_ata,
                    destination_owner,
                    mint,
                    token_program,
                )
            )
        instructions.append(
            _token_transfer_instruction(
                source,
                mint,
                destination_ata,
                source_owner,
                token_program,
                raw_amount,
                decimals,
            )
        )
    else:
        instructions.append(
            transfer(
                TransferParams(
                    from_pubkey=source_owner,
                    to_pubkey=destination_owner,
                    lamports=int(round(body.amount * 1_000_000_000)),
                )
            )
        )

    message = MessageV0.try_compile(
        payer=source_owner,
        instructions=instructions,
        address_lookup_table_accounts=[],
        recent_blockhash=Hash.from_string(blockhash["blockhash"]),
    )
    return message, blockhash


async def _confirm(
    client: SolanaRPCClient,
    signature: str,
    *,
    timeout_seconds: float = 45.0,
) -> dict[str, Any]:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while asyncio.get_running_loop().time() < deadline:
        status = await client.signature_status(signature)
        if status:
            if status.get("err"):
                return {
                    "confirmed": False,
                    "err": status.get("err"),
                    "confirmation_status": status.get("confirmationStatus"),
                }
            if status.get("confirmationStatus") in {"confirmed", "finalized"}:
                return {
                    "confirmed": True,
                    "confirmation_status": status.get("confirmationStatus"),
                    "slot": status.get("slot"),
                }
        await asyncio.sleep(1.0)
    return {"confirmed": False, "timeout": True}


@router.get("/records")
async def records(state=Depends(require_session)):
    return list(reversed(state.vault.data().get("execution_records", [])))[:500]


@router.post("/simulate")
async def simulate(body: SimulateTransfer, state=Depends(require_session)):
    wallet = _get_wallet(state, body.wallet_id)
    if wallet.get("watch_only") or not wallet.get("signing_enabled"):
        raise HTTPException(status_code=409, detail="Wallet cannot sign")

    from ..core.feature_suite import FeatureSuite
    try:
        policy_result = FeatureSuite(state).evaluate_transfer(network="solana", destination=body.destination, value=body.amount, wallet_id=body.wallet_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not policy_result["allowed"]:
        raise HTTPException(status_code=409, detail={"code": "TRANSACTION_POLICY_BLOCKED", "policy": policy_result})

    client = _solana_client(state)
    try:
        message, blockhash = await _build_transfer_message(client, state, wallet, body)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to construct transfer") from exc

    unsigned = VersionedTransaction.populate(message, [Signature.default()])
    simulation = await client.simulate_transaction(
        base64.b64encode(bytes(unsigned)).decode("ascii"),
        sig_verify=False,
    )
    simulation_value = simulation.get("value", {})
    fee_message = base64.b64encode(to_bytes_versioned(message)).decode("ascii")
    estimated_fee = await client.get_fee_for_message(fee_message)
    from decimal import Decimal
    fee_sol = Decimal(str(estimated_fee or 0)) / Decimal("1000000000")
    try:
        policy_result = FeatureSuite(state).evaluate_transfer(
            network="solana", destination=body.destination, value=body.amount,
            wallet_id=body.wallet_id, fee=fee_sol,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not policy_result["allowed"]:
        raise HTTPException(status_code=409, detail={"code": "TRANSACTION_POLICY_BLOCKED", "policy": policy_result})

    simulation_id = secrets.token_hex(8)
    record = _new_record(
        wallet_id=body.wallet_id,
        destination=body.destination,
        amount=body.amount,
        asset_mint=body.asset_mint,
        state_value=ExecutionState.SIMULATED if not simulation_value.get("err") else ExecutionState.FAILED,
        reason=str(simulation_value.get("err")) if simulation_value.get("err") else None,
    )
    record.update(
        {
            "simulation_id": simulation_id,
            "recent_blockhash": blockhash["blockhash"],
            "last_valid_block_height": blockhash.get("lastValidBlockHeight"),
            "estimated_fee_lamports": estimated_fee,
            "units_consumed": simulation_value.get("unitsConsumed"),
            "logs": simulation_value.get("logs"),
            "risk_assessment": policy_result,
        }
    )
    _record(state, record)

    return {
        "ok": not bool(simulation_value.get("err")),
        "simulation_id": simulation_id,
        "wallet_id": body.wallet_id,
        "destination": body.destination,
        "amount": body.amount,
        "asset_mint": body.asset_mint,
        "estimated_fee_lamports": int(estimated_fee or 0),
        "status": record["state"],
        "risk_assessment": policy_result,
        "error": simulation_value.get("err"),
    }


@router.post("/transfer")
async def transfer_execute(body: ExecuteTransfer, state=Depends(require_session)):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Explicit confirmation is required")
    from ..core.feature_suite import FeatureSuite
    try:
        policy_result = FeatureSuite(state).evaluate_transfer(network="solana", destination=body.destination, value=body.amount, wallet_id=body.wallet_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    recipient = policy_result["recipient"]
    if recipient["requires_confirmation"] and not body.confirm_new_recipient:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "NEW_RECIPIENT_CONFIRMATION_REQUIRED",
                "message": "This destination is new or not trusted. Confirm the exact address before continuing.",
                "destination": body.destination,
            },
        )
    if not policy_result["allowed"]:
        raise HTTPException(status_code=409, detail={"code": "TRANSACTION_POLICY_BLOCKED", "policy": policy_result})
    if policy_result["review_required"] and not body.confirm_risk_warnings:
        raise HTTPException(status_code=409, detail={"code": "ADDITIONAL_RISK_CONFIRMATION_REQUIRED", "message": "Review and explicitly confirm the transaction risk warnings.", "warnings": policy_result["warnings"]})

    wallet = _get_wallet(state, body.wallet_id)
    if wallet.get("watch_only") or not wallet.get("signing_enabled") or not wallet.get("broadcasting_enabled"):
        raise HTTPException(status_code=409, detail="Wallet is not permitted to broadcast")

    simulation = next(
        (
            item
            for item in state.vault.data().get("execution_records", [])
            if item.get("simulation_id") == body.simulation_id or item.get("id") == body.simulation_id
        ),
        None,
    )
    if not simulation or simulation.get("state") != ExecutionState.SIMULATED.value:
        raise HTTPException(status_code=409, detail="A successful transfer simulation is required")
    if (simulation.get("wallet_id") != body.wallet_id
            or simulation.get("destination") != body.destination
            or simulation.get("amount") != body.amount
            or simulation.get("asset_mint") != body.asset_mint):
        raise HTTPException(status_code=409, detail="Transfer details do not match the approved simulation")
    from decimal import Decimal
    estimated_fee_sol = Decimal(str(simulation.get("estimated_fee_lamports", 0) or 0)) / Decimal("1000000000")
    try:
        policy_result = FeatureSuite(state).evaluate_transfer(
            network="solana", destination=body.destination, value=body.amount,
            wallet_id=body.wallet_id, fee=estimated_fee_sol,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    recipient = policy_result["recipient"]
    if recipient["requires_confirmation"] and not body.confirm_new_recipient:
        raise HTTPException(status_code=409, detail={"code": "NEW_RECIPIENT_CONFIRMATION_REQUIRED",
            "message": "This destination is new or not trusted. Confirm the exact address before continuing.",
            "destination": body.destination})
    if not policy_result["allowed"]:
        raise HTTPException(status_code=409, detail={"code": "TRANSACTION_POLICY_BLOCKED", "policy": policy_result})
    if policy_result["review_required"] and not body.confirm_risk_warnings:
        raise HTTPException(status_code=409, detail={"code": "ADDITIONAL_RISK_CONFIRMATION_REQUIRED",
            "message": "Review the current transaction risk warnings, including the fee quote, before continuing.",
            "warnings": policy_result["warnings"]})

    # A successful simulation is a one-use authorization artifact. Serialize
    # the claim so simultaneous requests cannot both proceed to signing.
    async with state.mutex:
        try:
            claim_simulation_once(simulation)
        except SimulationAlreadyConsumed as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        state.vault.save()

    record = _new_record(
        wallet_id=body.wallet_id,
        destination=body.destination,
        amount=body.amount,
        asset_mint=body.asset_mint,
        state_value=ExecutionState.AWAITING_SIGNER,
    )
    record["simulation_id"] = body.simulation_id
    record["recipient_known"] = recipient["known"]
    record["recipient_trusted"] = recipient["trusted"]
    record["new_recipient_confirmed"] = bool(body.confirm_new_recipient)
    record["risk_assessment"] = policy_result
    record["risk_warnings_confirmed"] = bool(body.confirm_risk_warnings)
    _record(state, record)

    if not live_execution_enabled():
        _update_record(
            state,
            record,
            state=ExecutionState.AWAITING_SIGNER.value,
            reason="Live execution is disabled. Set ENABLE_LIVE_EXECUTION=true after reviewing the simulation.",
        )
        return {**record, "adapter_status": "READY_BUT_DISABLED"}

    try:
        client = _solana_client(state)
        message, blockhash = await _build_transfer_message(client, state, wallet, body)
        unsigned = VersionedTransaction.populate(message, [Signature.default()])
        signer = local_signer_from_wallet(wallet)
        signed = signer.sign_versioned(unsigned)
        wire = base64.b64encode(bytes(signed)).decode("ascii")

        simulation_result = await client.simulate_transaction(wire, sig_verify=True)
        simulation_value = simulation_result.get("value", {})
        if simulation_value.get("err"):
            _update_record(
                state,
                record,
                state=ExecutionState.FAILED.value,
                reason="Signed transaction failed preflight simulation.",
                simulation_error=simulation_value.get("err"),
            )
            return record

        _update_record(state, record, state=ExecutionState.SIGNED.value)
        signature = await client.send_raw_transaction(wire)
        _update_record(
            state,
            record,
            state=ExecutionState.BROADCASTED.value,
            broadcasted=True,
            signature=signature,
            last_valid_block_height=blockhash.get("lastValidBlockHeight"),
        )

        confirmation = await _confirm(client, str(signature))
        if confirmation.get("confirmed"):
            _update_record(
                state,
                record,
                state=ExecutionState.CONFIRMED.value,
                confirmed=True,
                confirmation=confirmation,
            )
        else:
            _update_record(
                state,
                record,
                state=ExecutionState.FAILED.value,
                reason="Transaction was broadcast but did not confirm before timeout or returned an error.",
                confirmation=confirmation,
            )
        await state.emit("execution.state", record)
        return record
    except Exception as exc:
        _update_record(
            state,
            record,
            state=ExecutionState.FAILED.value,
            reason=type(exc).__name__,
        )
        await state.emit("execution.state", record)
        return record


@router.post("/swap/quote")
async def swap_quote(body: SwapQuoteRequest, state=Depends(require_session)):
    wallet = _get_wallet(state, body.wallet_id)
    registry = ProviderRegistry(state.vault.data().get("providers", {}))
    jupiter = registry.get("jupiter")
    if not jupiter.configured():
        raise HTTPException(status_code=503, detail="Jupiter is not configured")
    quote = await jupiter.quote(
        input_mint=body.input_mint,
        output_mint=body.output_mint,
        amount=body.amount,
        slippage_bps=body.slippage_bps,
    )
    return {
        "status": ExecutionState.QUOTED.value,
        "wallet_id": body.wallet_id,
        "wallet_address": wallet["address"],
        "quote": quote,
    }


@router.post("/swap/build")
async def swap_build(body: SwapQuoteRequest, state=Depends(require_session)):
    wallet = _get_wallet(state, body.wallet_id)
    registry = ProviderRegistry(state.vault.data().get("providers", {}))
    jupiter = registry.get("jupiter")
    if not jupiter.configured():
        raise HTTPException(status_code=503, detail="Jupiter is not configured")

    quote = await jupiter.quote(
        input_mint=body.input_mint,
        output_mint=body.output_mint,
        amount=body.amount,
        slippage_bps=body.slippage_bps,
    )
    built = await jupiter.build_swap(
        user_public_key=wallet["address"],
        quote_response=quote,
    )
    record = _new_record(
        wallet_id=body.wallet_id,
        destination=None,
        amount=body.amount,
        asset_mint=body.input_mint,
        state_value=ExecutionState.BUILT,
    )
    record.update(
        {
            "output_mint": body.output_mint,
            "quote": quote,
            "swap_transaction": built["swapTransaction"],
            "last_valid_block_height": built.get("lastValidBlockHeight"),
            "prioritization_fee_lamports": built.get("prioritizationFeeLamports"),
        }
    )
    _record(state, record)
    return record


@router.post("/swap/execute")
async def swap_execute(body: SwapExecuteRequest, state=Depends(require_session)):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Explicit confirmation is required")

    wallet = _get_wallet(state, body.wallet_id)
    if wallet.get("watch_only") or not wallet.get("signing_enabled"):
        raise HTTPException(status_code=409, detail="Wallet cannot sign")

    built = await swap_build(body, state)
    record = built
    if not live_execution_enabled():
        _update_record(
            state,
            record,
            state=ExecutionState.AWAITING_SIGNER.value,
            reason="Swap transaction built and simulated pathway is ready, but live execution is disabled.",
        )
        return record

    try:
        raw = base64.b64decode(record["swap_transaction"])
        unsigned = VersionedTransaction.from_bytes(raw)
        signer = local_signer_from_wallet(wallet)
        signed = signer.sign_versioned(unsigned)
        wire = base64.b64encode(bytes(signed)).decode("ascii")
        client = _solana_client(state)

        preflight = await client.simulate_transaction(wire, sig_verify=True)
        preflight_value = preflight.get("value", {})
        if preflight_value.get("err"):
            _update_record(
                state,
                record,
                state=ExecutionState.FAILED.value,
                reason="Jupiter swap failed preflight simulation.",
                simulation_error=preflight_value.get("err"),
            )
            return record

        _update_record(state, record, state=ExecutionState.SIGNED.value)
        signature = await client.send_raw_transaction(wire)
        _update_record(
            state,
            record,
            state=ExecutionState.BROADCASTED.value,
            broadcasted=True,
            signature=signature,
        )
        confirmation = await _confirm(client, str(signature))
        if confirmation.get("confirmed"):
            _update_record(
                state,
                record,
                state=ExecutionState.CONFIRMED.value,
                confirmed=True,
                confirmation=confirmation,
            )
        else:
            _update_record(
                state,
                record,
                state=ExecutionState.FAILED.value,
                confirmation=confirmation,
                reason="Swap broadcast did not reach confirmation before timeout.",
            )
        await state.emit("execution.state", record)
        return record
    except Exception as exc:
        _update_record(
            state,
            record,
            state=ExecutionState.FAILED.value,
            reason=type(exc).__name__,
        )
        return record


@router.post("/swap/simulate")
async def swap_simulate(body: SwapQuoteRequest, state=Depends(require_session)):
    wallet = _get_wallet(state, body.wallet_id)
    registry = ProviderRegistry(state.vault.data().get("providers", {}))
    jupiter = registry.get("jupiter")
    if not jupiter.configured():
        return {
            "ok": False,
            "status": "UNCONFIGURED",
            "adapter_status": "JUPITER_UNCONFIGURED",
            "message": "Configure Jupiter to obtain a real quote and swap transaction.",
            "executable": False,
        }

    quote = await jupiter.quote(
        input_mint=body.input_mint,
        output_mint=body.output_mint,
        amount=body.amount,
        slippage_bps=body.slippage_bps,
    )
    built = await jupiter.build_swap(
        user_public_key=wallet["address"],
        quote_response=quote,
    )
    client = _solana_client(state)
    raw = base64.b64decode(built["swapTransaction"])
    unsigned = VersionedTransaction.from_bytes(raw)
    signer = local_signer_from_wallet(wallet)
    signed = signer.sign_versioned(unsigned)
    simulation = await client.simulate_transaction(
        base64.b64encode(bytes(signed)).decode("ascii"),
        sig_verify=True,
    )
    simulation_value = simulation.get("value", {})
    return {
        "ok": not bool(simulation_value.get("err")),
        "status": ExecutionState.SIMULATED.value if not simulation_value.get("err") else ExecutionState.FAILED.value,
        "adapter_status": "JUPITER_READY",
        "message": "Jupiter swap transaction was built and simulated without broadcast.",
        "executable": live_execution_enabled() and not bool(simulation_value.get("err")),
        "quote": quote,
        "last_valid_block_height": built.get("lastValidBlockHeight"),
        "simulation": simulation.get("value"),
    }