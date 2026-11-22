from __future__ import annotations

from typing import Any

from ..rpc.pool import RPCPool


TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"


class SolanaRPCClient:
    def __init__(self, pool: RPCPool, network: str = "mainnet-beta") -> None:
        self.pool = pool
        self.network = network

    async def call(self, method: str, params: list[Any] | None = None) -> dict[str, Any]:
        return await self.pool.request(
            network=self.network,
            method=method,
            params=params or [],
        )

    async def get_balance(self, address: str) -> dict[str, Any]:
        payload = await self.call(
            "getBalance",
            [address, {"commitment": "confirmed"}],
        )
        return payload.get("result", {})

    async def get_token_accounts(self, address: str) -> list[dict[str, Any]]:
        accounts: list[dict[str, Any]] = []
        for program_id in (TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID):
            payload = await self.call(
                "getTokenAccountsByOwner",
                [
                    address,
                    {"programId": program_id},
                    {"encoding": "jsonParsed", "commitment": "confirmed"},
                ],
            )
            accounts.extend(payload.get("result", {}).get("value", []))
        return accounts

    async def get_account_info(self, address: str) -> dict[str, Any] | None:
        payload = await self.call(
            "getAccountInfo",
            [address, {"encoding": "jsonParsed", "commitment": "confirmed"}],
        )
        return payload.get("result")

    async def get_latest_blockhash(self) -> dict[str, Any]:
        payload = await self.call(
            "getLatestBlockhash",
            [{"commitment": "confirmed"}],
        )
        return payload.get("result", {}).get("value", {})

    async def get_block_height(self) -> int:
        payload = await self.call(
            "getBlockHeight",
            [{"commitment": "confirmed"}],
        )
        return int(payload.get("result", 0))

    async def simulate_transaction(
        self,
        wire_base64: str,
        *,
        sig_verify: bool = True,
    ) -> dict[str, Any]:
        payload = await self.call(
            "simulateTransaction",
            [
                wire_base64,
                {
                    "encoding": "base64",
                    "sigVerify": sig_verify,
                    "replaceRecentBlockhash": False,
                },
            ],
        )
        return payload.get("result", {})

    async def get_fee_for_message(self, message_base64: str) -> int | None:
        payload = await self.call(
            "getFeeForMessage",
            [message_base64, {"commitment": "confirmed"}],
        )
        return payload.get("result", {}).get("value")

    async def send_raw_transaction(self, wire_base64: str) -> dict[str, Any]:
        payload = await self.call(
            "sendTransaction",
            [
                wire_base64,
                {
                    "encoding": "base64",
                    "skipPreflight": False,
                    "preflightCommitment": "confirmed",
                    "maxRetries": 3,
                },
            ],
        )
        return payload.get("result")

    async def signature_status(self, signature: str) -> dict[str, Any] | None:
        payload = await self.call(
            "getSignatureStatuses",
            [[signature], {"searchTransactionHistory": True}],
        )
        values = payload.get("result", {}).get("value") or []
        return values[0] if values else None

    async def get_signatures(
        self,
        address: str,
        *,
        limit: int = 50,
        before: str | None = None,
    ) -> list[dict[str, Any]]:
        params: list[Any] = [
            address,
            {"limit": max(1, min(limit, 1000))},
        ]
        if before:
            params[1]["before"] = before
        payload = await self.call("getSignaturesForAddress", params)
        return list(payload.get("result", []))

    async def get_transaction(self, signature: str) -> dict[str, Any] | None:
        payload = await self.call(
            "getTransaction",
            [
                signature,
                {
                    "encoding": "jsonParsed",
                    "commitment": "confirmed",
                    "maxSupportedTransactionVersion": 0,
                },
            ],
        )
        return payload.get("result")