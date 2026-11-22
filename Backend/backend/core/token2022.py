from __future__ import annotations

from typing import Any


SUPPORTED_EXTENSIONS = {
    "transferFeeConfig",
    "transferHook",
    "defaultAccountState",
    "permanentDelegate",
    "mintCloseAuthority",
    "confidentialTransferMint",
    "confidentialTransferFeeConfig",
    "interestBearingConfig",
    "nonTransferable",
    "metadataPointer",
    "groupPointer",
    "groupMemberPointer",
    "tokenMetadata",
    "pausable",
    "transferFeeAmount",
    "immutableOwner",
    "memoTransfer",
    "cpiGuard",
}


def normalize_extensions(
    account_info: dict[str, Any] | None,
) -> dict[str, Any]:
    value = (account_info or {}).get("value", account_info or {})
    parsed = value.get("data", {}).get("parsed", {}) if isinstance(value, dict) else {}
    info = parsed.get("info", {}) if isinstance(parsed, dict) else {}
    raw_extensions = info.get("extensions") or []
    normalized: list[dict[str, Any]] = []

    for extension in raw_extensions:
        if not isinstance(extension, dict):
            continue
        extension_type = extension.get("extension")
        value = extension.get("state")
        normalized.append(
            {
                "type": extension_type,
                "supported": extension_type in SUPPORTED_EXTENSIONS,
                "state": value,
            }
        )

    transfer_fee = next(
        (item for item in normalized if item["type"] == "transferFeeConfig"),
        None,
    )
    interest = next(
        (item for item in normalized if item["type"] == "interestBearingConfig"),
        None,
    )

    return {
        "extensions": normalized,
        "extension_types": [item["type"] for item in normalized if item["type"]],
        "has_unsupported_extensions": any(not item["supported"] for item in normalized),
        "transfer_fee": transfer_fee.get("state") if transfer_fee else None,
        "interest_bearing": interest.get("state") if interest else None,
    }