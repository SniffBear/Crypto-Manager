from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import httpx

from .registry import Network


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _units(raw: int | str, decimals: int) -> str:
    value = Decimal(str(raw)) / (Decimal(10) ** decimals)
    return format(value, "f")


class AdapterError(RuntimeError):
    pass


class ReadOnlyAdapter:
    def __init__(self, network: Network, config: dict[str, Any]) -> None:
        self.network = network
        self.config = config or {}
        self.base_url = str(self.config.get("base_url") or network.default_endpoint or "").rstrip("/")
        self.api_key = self.config.get("api_key")
        self.timeout = float(self.config.get("timeout", 15))

    def _headers(self) -> dict[str, str]:
        headers = {"accept": "application/json"}
        if self.api_key:
            # Providers may document a different header; the configured
            # provider_header is explicit and never inferred from a key.
            header = str(self.config.get("api_key_header") or "x-api-key")
            headers[header] = str(self.api_key)
        return headers

    async def request(self, method: str, path: str = "", *, params=None, body=None) -> Any:
        if not self.base_url:
            raise AdapterError(f"No provider endpoint configured for {self.network.id}")
        url = self.base_url + ("/" + path.lstrip("/") if path else "")
        auth = None
        if self.config.get("username") is not None:
            auth = (str(self.config.get("username")), str(self.config.get("password") or ""))
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False, auth=auth) as client:
                response = await client.request(method, url, params=params, json=body, headers=self._headers())
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException as exc:
            raise AdapterError("Provider request timed out") from exc
        except httpx.HTTPStatusError as exc:
            raise AdapterError(f"Provider returned HTTP {exc.response.status_code}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise AdapterError("Provider request failed or returned invalid JSON") from exc

    async def health(self) -> dict[str, Any]:
        return {
            "network_id": self.network.id,
            "status": "CONFIGURED" if self.base_url else "UNCONFIGURED",
            "provider_kind": self.network.provider_kind,
            "checked_at": _now(),
        }

    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        raise AdapterError(f"Read-only synchronization is not implemented for {self.network.id}")


class EVMReadAdapter(ReadOnlyAdapter):
    async def _rpc(self, method: str, params: list[Any]) -> Any:
        payload = await self.request("POST", body={"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
        if not isinstance(payload, dict) or payload.get("error"):
            raise AdapterError(f"EVM RPC method {method} failed")
        if "result" not in payload:
            raise AdapterError(f"EVM RPC method {method} returned no result")
        return payload["result"]

    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        address = str(wallet.get("address") or "")
        if len(address) != 42 or not address.startswith("0x"):
            raise AdapterError("Invalid EVM address")
        remote_chain_id = int(str(await self._rpc("eth_chainId", [])), 16)
        if remote_chain_id != self.network.chain_id:
            raise AdapterError(
                f"RPC chain ID mismatch: expected {self.network.chain_id}, received {remote_chain_id}"
            )
        raw_balance = int(str(await self._rpc("eth_getBalance", [address, "latest"])), 16)
        block_hex = await self._rpc("eth_blockNumber", [])
        token_balances: list[dict[str, Any]] = []
        for contract in wallet.get("token_contracts", [])[:100]:
            token = str(contract).lower()
            if len(token) != 42 or not token.startswith("0x"):
                continue
            call_data = "0x70a08231" + address[2:].lower().rjust(64, "0")
            try:
                token_raw = int(str(await self._rpc("eth_call", [{"to": token, "data": call_data}, "latest"])), 16)
                decimals_raw = await self._rpc("eth_call", [{"to": token, "data": "0x313ce567"}, "latest"])
                decimals = int(str(decimals_raw), 16)
                if 0 <= decimals <= 36:
                    token_balances.append({
                        "asset_id": token,
                        "contract": token,
                        "symbol": (wallet.get("token_symbols") or {}).get(token),
                        "balance_raw": str(token_raw),
                        "decimals": decimals,
                        "balance": _units(token_raw, decimals),
                    })
            except (AdapterError, ValueError):
                continue
        return {
            "network_id": self.network.id,
            "chain": self.network.chain,
            "status": "SYNCED",
            "source": "EVM_JSON_RPC",
            "chain_id": remote_chain_id,
            "block_number": int(str(block_hex), 16),
            "native_asset": self.network.symbol,
            "balance_raw": str(raw_balance),
            "decimals": self.network.decimals,
            "balance": _units(raw_balance, self.network.decimals),
            "token_balances": token_balances,
            "activity": None,
            "activity_status": "NOT_CONFIGURED",
            "synced_at": _now(),
        }


class EsploraReadAdapter(ReadOnlyAdapter):
    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        address = str(wallet.get("address") or "")
        info = await self.request("GET", f"address/{address}")
        chain = info.get("chain_stats") or {}
        mempool = info.get("mempool_stats") or {}
        funded = int(chain.get("funded_txo_sum", 0))
        spent = int(chain.get("spent_txo_sum", 0))
        mempool_funded = int(mempool.get("funded_txo_sum", 0))
        mempool_spent = int(mempool.get("spent_txo_sum", 0))
        txs = await self.request("GET", f"address/{address}/txs")
        activity = []
        for tx in txs[:50] if isinstance(txs, list) else []:
            activity.append({
                "txid": tx.get("txid"),
                "confirmed": bool((tx.get("status") or {}).get("confirmed")),
                "block_height": (tx.get("status") or {}).get("block_height"),
                "block_time": (tx.get("status") or {}).get("block_time"),
                "fee_sats": tx.get("fee"),
            })
        raw = funded - spent
        mempool_delta = mempool_funded - mempool_spent
        return {
            "network_id": self.network.id,
            "chain": self.network.chain,
            "status": "SYNCED",
            "source": "ESPLORA",
            "native_asset": self.network.symbol,
            "balance_raw": str(raw),
            "unconfirmed_delta_raw": str(mempool_delta),
            "decimals": self.network.decimals,
            "balance": _units(raw, self.network.decimals),
            "unconfirmed_delta": _units(mempool_delta, self.network.decimals),
            "activity": activity,
            "activity_status": "PARTIAL_FIRST_PAGE",
            "synced_at": _now(),
        }


class BlockbookReadAdapter(ReadOnlyAdapter):
    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        address = str(wallet.get("address") or "")
        info = await self.request("GET", f"api/v2/address/{address}", params={"details": "txs"})
        balance = Decimal(str(info.get("balance", "0")))
        unconfirmed = Decimal(str(info.get("unconfirmedBalance", "0")))
        txs = info.get("transactions") or info.get("txids") or []
        activity = [
            {"txid": item if isinstance(item, str) else item.get("txid"), "source": "BLOCKBOOK"}
            for item in txs[:50]
        ]
        return {
            "network_id": self.network.id,
            "chain": self.network.chain,
            "status": "SYNCED",
            "source": "BLOCKBOOK",
            "native_asset": self.network.symbol,
            "balance": format(balance, "f"),
            "unconfirmed_delta": format(unconfirmed, "f"),
            "decimals": self.network.decimals,
            "activity": activity,
            "activity_status": "PARTIAL_PROVIDER_PAGE",
            "synced_at": _now(),
        }


class ErgoReadAdapter(ReadOnlyAdapter):
    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        result = await self.request("POST", "blockchain/balance", body={"address": wallet.get("address")})
        confirmed = int(result.get("confirmedBalance", result.get("confirmed", {}).get("nanoErgs", 0)))
        unconfirmed = int(result.get("unconfirmedBalance", result.get("unconfirmed", {}).get("nanoErgs", 0)))
        return {
            "network_id": self.network.id,
            "chain": "ergo",
            "status": "SYNCED",
            "source": "ERGO_INDEXED_NODE",
            "native_asset": "ERG",
            "balance_raw": str(confirmed),
            "unconfirmed_raw": str(unconfirmed),
            "decimals": 9,
            "balance": _units(confirmed, 9),
            "unconfirmed_balance": _units(unconfirmed, 9),
            "activity": None,
            "activity_status": "NOT_IMPLEMENTED",
            "synced_at": _now(),
        }


class KaspaReadAdapter(ReadOnlyAdapter):
    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        address = str(wallet.get("address") or "")
        result = await self.request("GET", f"addresses/{address}/balance")
        raw = int(result.get("balance", result.get("total", 0)))
        return {
            "network_id": self.network.id,
            "chain": "kaspa",
            "status": "SYNCED",
            "source": "KASPA_REST",
            "native_asset": "KAS",
            "balance_raw": str(raw),
            "decimals": 8,
            "balance": _units(raw, 8),
            "activity": None,
            "activity_status": "NOT_IMPLEMENTED",
            "synced_at": _now(),
        }


class MoneroWalletRPCAdapter(ReadOnlyAdapter):
    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        # Monero address balances cannot be reliably queried from a public
        # address alone. This adapter connects to a local monero-wallet-rpc
        # instance with the user's view-only wallet already opened.
        account_index = int(wallet.get("account_index", 0))
        address_result = await self.request("POST", "json_rpc", body={
            "jsonrpc": "2.0", "id": "0", "method": "get_address",
            "params": {"account_index": account_index},
        })
        address_payload = address_result.get("result", address_result)
        addresses = address_payload.get("addresses", [])
        expected_address = str(wallet.get("address") or "")
        matched = next((item for item in addresses if item.get("address") == expected_address), None)
        if not matched and address_payload.get("address") != expected_address:
            raise AdapterError("Configured Monero wallet RPC does not match the imported wallet address")
        address_index = matched.get("address_index") if matched else None
        if isinstance(address_index, dict):
            address_index = address_index.get("minor")
        balance_params = {"account_index": account_index}
        if address_index is not None:
            balance_params["address_indices"] = [int(address_index)]
        result = await self.request("POST", "json_rpc", body={
            "jsonrpc": "2.0", "id": "0", "method": "get_balance",
            "params": balance_params,
        })
        payload = result.get("result", result)
        raw = int(payload.get("balance", 0))
        unlocked = int(payload.get("unlocked_balance", 0))
        transfers_result = await self.request("POST", "json_rpc", body={
            "jsonrpc": "2.0", "id": "0", "method": "get_transfers",
            "params": {
                "in": True, "out": True, "pending": True, "failed": True, "pool": True,
                "account_index": account_index,
                **({"subaddr_indices": [int(address_index)]} if address_index is not None else {}),
            },
        })
        transfers_payload = transfers_result.get("result", transfers_result)
        activity = []
        for direction in ("in", "out", "pending", "failed", "pool"):
            for item in transfers_payload.get(direction, [])[:250]:
                if address_index is not None:
                    subaddress = item.get("subaddr_index") or {}
                    if subaddress.get("minor") not in (None, address_index):
                        continue
                activity.append({
                    "txid": item.get("txid"),
                    "direction": direction,
                    "amount_atomic": str(item.get("amount", 0)),
                    "fee_atomic": str(item.get("fee", 0)),
                    "height": item.get("height"),
                    "timestamp": item.get("timestamp"),
                    "confirmations": item.get("confirmations"),
                    "pending": bool(item.get("pending", direction in {"pending", "pool"})),
                })
        activity.sort(key=lambda item: item.get("timestamp") or 0, reverse=True)
        return {
            "network_id": self.network.id,
            "chain": "monero",
            "status": "SYNCED",
            "source": "MONERO_WALLET_RPC",
            "native_asset": "XMR",
            "balance_raw": str(raw),
            "unlocked_balance_raw": str(unlocked),
            "decimals": 12,
            "balance": _units(raw, 12),
            "unlocked_balance": _units(unlocked, 12),
            "activity": activity[:250],
            "activity_status": "SYNCED",
            "synced_at": _now(),
        }


class ZanoWalletRPCAdapter(ReadOnlyAdapter):
    async def sync_wallet(self, wallet: dict[str, Any]) -> dict[str, Any]:
        address_result = await self.request("POST", "json_rpc", body={
            "jsonrpc": "2.0", "id": 0, "method": "getaddress",
        })
        address_payload = address_result.get("result", address_result)
        expected_address = str(wallet.get("address") or "")
        own_address = str(address_payload.get("address") or "")
        if own_address != expected_address:
            split_result = await self.request("POST", "json_rpc", body={
                "jsonrpc": "2.0", "id": 0, "method": "split_integrated_address",
                "params": {"integrated_address": expected_address},
            })
            split_payload = split_result.get("result", split_result)
            if str(split_payload.get("standard_address") or "") != own_address:
                raise AdapterError("Configured Zano wallet RPC does not match the imported wallet address")
        result = await self.request("POST", "json_rpc", body={
            "jsonrpc": "2.0", "id": 0, "method": "getbalance",
        })
        payload = result.get("result", result)
        raw = int(payload.get("balance", 0))
        unlocked = int(payload.get("unlocked_balance", 0))
        return {
            "network_id": self.network.id,
            "chain": "zano",
            "status": "SYNCED",
            "source": "ZANO_WALLET_RPC",
            "native_asset": "ZANO",
            "balance_raw": str(raw),
            "unlocked_balance_raw": str(unlocked),
            "decimals": 12,
            "balance": _units(raw, 12),
            "unlocked_balance": _units(unlocked, 12),
            "activity": None,
            "activity_status": "NOT_IMPLEMENTED",
            "synced_at": _now(),
        }


def make_adapter(network: Network, config: dict[str, Any] | None = None) -> ReadOnlyAdapter:
    config = config or {}
    adapter_types = {
        "evm_rpc": EVMReadAdapter,
        "esplora": EsploraReadAdapter,
        "blockbook": BlockbookReadAdapter,
        "ergo_node": ErgoReadAdapter,
        "kaspa_rest": KaspaReadAdapter,
        "monero_wallet_rpc": MoneroWalletRPCAdapter,
        "zano_wallet_rpc": ZanoWalletRPCAdapter,
    }
    adapter_type = adapter_types.get(network.provider_kind)
    if adapter_type is None:
        raise AdapterError(f"No read adapter is registered for {network.provider_kind}")
    return adapter_type(network, config)
