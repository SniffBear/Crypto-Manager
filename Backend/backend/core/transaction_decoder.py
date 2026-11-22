from __future__ import annotations

from collections import defaultdict
from typing import Any


SYSTEM_PROGRAMS = {
    "11111111111111111111111111111111",
    "ComputeBudget111111111111111111111111111111",
    "Ed25519SigVerify111111111111111111111111111",
    "AddressLookupTab1e1111111111111111111111111",
}


def _account_address(item: Any) -> str | None:
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return item.get("pubkey") or item.get("address")
    return None


def _ui_amount(entry: dict[str, Any] | None) -> float:
    if not entry:
        return 0.0
    token_amount = entry.get("uiTokenAmount") or entry.get("tokenAmount") or {}
    value = token_amount.get("uiAmount")
    if value is not None:
        return float(value)
    raw = token_amount.get("amount")
    decimals = int(token_amount.get("decimals") or 0)
    if raw is None:
        return 0.0
    return int(raw) / (10 ** decimals)


def _token_balance_map(values: list[dict[str, Any]] | None) -> dict[tuple[int, str], dict[str, Any]]:
    result: dict[tuple[int, str], dict[str, Any]] = {}
    for entry in values or []:
        account_index = int(entry.get("accountIndex", -1))
        mint = entry.get("mint")
        if account_index < 0 or not mint:
            continue
        result[(account_index, mint)] = entry
    return result


def _program_label(program_id: str | None) -> str:
    if not program_id:
        return "unknown"
    known = {
        "11111111111111111111111111111111": "system",
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "spl-token",
        "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "token-2022",
        "JUP6LkbZbjS1jKKwapdHNy74zcB4eSGtMQb2mXy3ef": "jupiter",
        "whirLbMiicVdio4qvUfM5KAg6bH4t3R3QyM8s1fGqK": "orca",
        "675kPX9MHTjS2zt1qfr1NYHqQh9mZJdLh5xkZC8W6g": "raydium",
    }
    return known.get(program_id, program_id)


def _instruction_details(message: dict[str, Any], meta: dict[str, Any]) -> list[dict[str, Any]]:
    instructions: list[dict[str, Any]] = []
    outer = message.get("instructions") or []
    for index, instruction in enumerate(outer):
        program_id = instruction.get("programId")
        parsed = instruction.get("parsed") if isinstance(instruction, dict) else None
        record = {
            "index": index,
            "inner": False,
            "program_id": program_id,
            "program": _program_label(program_id),
            "type": parsed.get("type") if isinstance(parsed, dict) else None,
            "info": parsed.get("info") if isinstance(parsed, dict) else None,
            "accounts": instruction.get("accounts") if isinstance(instruction, dict) else None,
            "data": instruction.get("data") if isinstance(instruction, dict) else None,
        }
        instructions.append(record)

    for inner in meta.get("innerInstructions") or []:
        parent_index = inner.get("index")
        for offset, instruction in enumerate(inner.get("instructions") or []):
            program_id = instruction.get("programId")
            parsed = instruction.get("parsed") if isinstance(instruction, dict) else None
            instructions.append(
                {
                    "index": parent_index,
                    "inner_index": offset,
                    "inner": True,
                    "program_id": program_id,
                    "program": _program_label(program_id),
                    "type": parsed.get("type") if isinstance(parsed, dict) else None,
                    "info": parsed.get("info") if isinstance(parsed, dict) else None,
                    "accounts": instruction.get("accounts") if isinstance(instruction, dict) else None,
                    "data": instruction.get("data") if isinstance(instruction, dict) else None,
                }
            )
    return instructions


def decode_transaction(
    tx: dict[str, Any],
    *,
    wallet_address: str | None = None,
) -> dict[str, Any]:
    meta = tx.get("meta") or {}
    transaction = tx.get("transaction") or {}
    message = transaction.get("message") or {}
    account_keys = message.get("accountKeys") or []

    addresses = [_account_address(item) for item in account_keys]
    fee_lamports = int(meta.get("fee") or 0)

    native_changes: list[dict[str, Any]] = []
    before = meta.get("preBalances") or []
    after = meta.get("postBalances") or []
    for index, (pre, post) in enumerate(zip(before, after)):
        address = addresses[index] if index < len(addresses) else None
        if not address or pre == post:
            continue
        native_changes.append(
            {
                "address": address,
                "delta_lamports": int(post) - int(pre),
                "delta_sol": (int(post) - int(pre)) / 1_000_000_000,
            }
        )

    pre_token = _token_balance_map(meta.get("preTokenBalances"))
    post_token = _token_balance_map(meta.get("postTokenBalances"))
    token_keys = sorted(set(pre_token) | set(post_token))
    token_changes: list[dict[str, Any]] = []
    for key in token_keys:
        account_index, mint = key
        before_amount = _ui_amount(pre_token.get(key))
        after_amount = _ui_amount(post_token.get(key))
        delta = after_amount - before_amount
        if abs(delta) < 1e-18:
            continue
        owner = (post_token.get(key) or pre_token.get(key) or {}).get("owner")
        token_changes.append(
            {
                "account_index": account_index,
                "account": addresses[account_index] if account_index < len(addresses) else None,
                "owner": owner,
                "mint": mint,
                "delta": delta,
                "before": before_amount,
                "after": after_amount,
            }
        )

    instructions = _instruction_details(message, meta)
    program_ids = sorted(
        {
            item["program_id"]
            for item in instructions
            if item.get("program_id") and item["program_id"] not in SYSTEM_PROGRAMS
        }
    )

    has_swap_signals = any(
        item.get("program") in {"jupiter", "orca", "raydium"}
        or str(item.get("type") or "").lower() in {"swap", "route", "whirlpool"}
        for item in instructions
    )
    transfer_count = sum(
        1
        for item in instructions
        if str(item.get("type") or "").lower() in {
            "transfer",
            "transferChecked",
            "transferCheckedWithFee",
        }
    )

    wallet_in = []
    wallet_out = []
    if wallet_address:
        for change in native_changes:
            if change["address"] == wallet_address:
                (wallet_in if change["delta_lamports"] > 0 else wallet_out).append(change)
        for change in token_changes:
            if change.get("owner") == wallet_address:
                (wallet_in if change["delta"] > 0 else wallet_out).append(change)

    if has_swap_signals:
        event_type = "SWAP"
    elif transfer_count or token_changes or native_changes:
        event_type = "TRANSFER"
    elif program_ids:
        event_type = "PROGRAM_INTERACTION"
    else:
        event_type = "TRANSACTION"

    signers = [
        _account_address(item)
        for item in account_keys
        if isinstance(item, dict) and item.get("signer")
    ]
    counterparties = sorted(
        {
            change["address"]
            for change in native_changes
            if change["address"] and change["address"] != wallet_address
        }
        | {
            str(change["owner"])
            for change in token_changes
            if change.get("owner") and change.get("owner") != wallet_address
        }
    )

    return {
        "event_type": event_type,
        "signature": next(iter(transaction.get("signatures") or []), None),
        "slot": tx.get("slot"),
        "block_time": tx.get("blockTime"),
        "version": tx.get("version"),
        "status": "FAILED" if meta.get("err") else "CONFIRMED",
        "error": meta.get("err"),
        "fee_lamports": fee_lamports,
        "fee_sol": fee_lamports / 1_000_000_000,
        "signers": signers,
        "fee_payer": signers[0] if signers else None,
        "counterparties": counterparties,
        "program_ids": program_ids,
        "instructions": instructions,
        "native_changes": native_changes,
        "token_changes": token_changes,
        "wallet_changes": {
            "incoming": wallet_in,
            "outgoing": wallet_out,
        },
        "compute_units_consumed": meta.get("computeUnitsConsumed"),
        "loaded_addresses": meta.get("loadedAddresses"),
        "log_messages": meta.get("logMessages"),
    }