from __future__ import annotations

from typing import Any

import httpx

from .base import HttpProvider


class BitqueryProvider(HttpProvider):
    name = "bitquery"
    default_base_url = "https://streaming.bitquery.io/graphql"
    capabilities = {
        "graphql",
        "transactions",
        "transfers",
        "instructions",
        "dex_trades",
        "market_data",
    }

    requires_api_key = True

    def _headers(self) -> dict[str, str]:
        headers = super()._headers()
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def graphql(
        self,
        query: str,
        variables: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self.base_url,
                headers={
                    "content-type": "application/json",
                    "accept": "application/json",
                    **self._headers(),
                },
                json={"query": query, "variables": variables or {}},
            )
        response.raise_for_status()
        payload = response.json()
        if payload.get("errors"):
            raise RuntimeError("Bitquery GraphQL request failed")
        return payload.get("data") or {}

    async def transaction(self, signature: str) -> list[dict[str, Any]]:
        query = """
        query($signature: String!) {
          Solana(dataset: realtime) {
            Transactions(
              limit: {count: 1}
              where: {Transaction: {Signature: {is: $signature}}}
            ) {
              Block { Time Slot }
              Transaction {
                Signature
                Signer
                Fee
                InstructionsCount
                TokenBalanceUpdatesCount
                Result { Success ErrorMessage }
              }
            }
          }
        }
        """
        data = await self.graphql(query, {"signature": signature})
        return list(data.get("Solana", {}).get("Transactions", []))

    async def transfers(self, signature: str) -> list[dict[str, Any]]:
        query = """
        query($signature: String!) {
          Solana(dataset: realtime) {
            Transfers(
              limit: {count: 100}
              orderBy: {descending: Block_Slot}
              where: {Transaction: {Signature: {is: $signature}}}
            ) {
              Transaction { Signature }
              Block { Slot Time }
              Transfer {
                Amount
                AmountInUSD
                Sender { Address }
                Receiver { Address }
                Currency { MintAddress Name Symbol Decimals }
              }
            }
          }
        }
        """
        data = await self.graphql(query, {"signature": signature})
        return list(data.get("Solana", {}).get("Transfers", []))

    async def dex_trades_for_wallet(
        self,
        addresses: list[str],
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        query = """
        query($addressList: [String!], $limit: Int!) {
          Solana {
            DEXTrades(
              limit: {count: $limit}
              orderBy: {descending: Block_Time}
              where: {
                Transaction: {Result: {Success: true}}
                any: [
                  {Trade: {Buy: {Account: {Address: {in: $addressList}}}}}
                  {Trade: {Buy: {Account: {Token: {Owner: {in: $addressList}}}}}}
                  {Trade: {Sell: {Account: {Address: {in: $addressList}}}}}
                  {Trade: {Sell: {Account: {Token: {Owner: {in: $addressList}}}}}}
                ]
              }
            ) {
              Block { Time }
              Trade {
                Buy {
                  Amount
                  AmountInUSD
                  Account { Address }
                  Currency { Name Symbol MintAddress Decimals }
                }
                Sell {
                  Amount
                  AmountInUSD
                  Account { Address }
                  Currency { Name Symbol MintAddress Decimals }
                }
                Dex { ProtocolName }
              }
              Transaction { Signature Signer }
              Instruction { Program { Name Method Address } }
            }
          }
        }
        """
        data = await self.graphql(
            query,
            {"addressList": addresses[:100], "limit": min(100, max(1, limit))},
        )
        return list(data.get("Solana", {}).get("DEXTrades", []))

    async def token_price(self, mint: str) -> float | None:
        query = """
        query($mint: String!) {
          Solana {
            DEXTradeByTokens(
              limit: {count: 1}
              orderBy: {descending: Block_Time}
              where: {Trade: {Currency: {MintAddress: {is: $mint}}}}
            ) {
              Trade {
                PriceInUSD
              }
            }
          }
        }
        """
        try:
            data = await self.graphql(query, {"mint": mint})
            rows = data.get("Solana", {}).get("DEXTradeByTokens", [])
            value = rows[0].get("Trade", {}).get("PriceInUSD") if rows else None
            return float(value) if value is not None else None
        except Exception:
            return None

    async def health(self) -> dict[str, Any]:
        if not self.api_key:
            return {
                "provider": self.name,
                "status": "UNCONFIGURED",
                "configured": False,
                "latency_ms": None,
            }
        try:
            await self.graphql("query { Solana { Transactions(limit: {count: 1}) { Transaction { Signature } } } }")
            return {"provider": self.name, "status": "OK", "configured": True}
        except httpx.TimeoutException:
            return {"provider": self.name, "status": "TIMEOUT", "configured": True}
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            return {
                "provider": self.name,
                "status": "RATE_LIMITED" if code == 429 else (
                    "UNAUTHORIZED" if code in {401, 403} else "DEGRADED"
                ),
                "configured": True,
                "http_status": code,
            }
        except Exception as exc:
            return {
                "provider": self.name,
                "status": "ERROR",
                "configured": True,
                "error": type(exc).__name__,
            }