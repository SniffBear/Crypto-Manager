from __future__ import annotations

from backend.chains.addresses import validate_address
from backend.chains.registry import get_network, list_networks, network_id_for
from backend.core.state import AppState
from backend.core.vault import VaultManager
from backend.core.wallets import WalletService


def test_registry_exposes_all_requested_network_families():
    networks = {item["id"]: item for item in list_networks()}
    required = {
        "solana-mainnet-beta",
        "ethereum-mainnet",
        "ethereum-sepolia",
        "ethereum-classic-mainnet",
        "ethereum-classic-mordor",
        "base-mainnet",
        "arbitrum-one",
        "optimism-mainnet",
        "polygon-mainnet",
        "bsc-mainnet",
        "bitcoin-mainnet",
        "bitcoin-testnet",
        "litecoin-mainnet",
        "dogecoin-mainnet",
        "ravencoin-mainnet",
        "ergo-mainnet",
        "kaspa-mainnet",
        "monero-mainnet",
        "monero-stagenet",
        "zano-mainnet",
    }
    assert required <= set(networks)
    assert networks["ethereum-mainnet"]["chain_id"] == 1
    assert networks["base-mainnet"]["chain_id"] == 8453
    assert networks["arbitrum-one"]["chain_id"] == 42161


def test_network_id_aliases_are_resolved():
    assert network_id_for("solana", "mainnet-beta") == "solana-mainnet-beta"
    assert network_id_for("ethereum-classic", "mainnet") == "ethereum-classic-mainnet"
    assert network_id_for("kaspa", "testnet") == "kaspa-testnet-10"


def test_evm_address_validation_accepts_lowercase_and_valid_checksum():
    network = get_network("ethereum-mainnet")
    lower = "0x52908400098527886e0f7030069857d2e4169ee7"
    checksummed = "0x52908400098527886E0F7030069857D2E4169EE7"

    assert validate_address(network, lower).valid
    assert validate_address(network, checksummed).valid


def test_evm_address_validation_rejects_bad_mixed_case_checksum():
    network = get_network("ethereum-mainnet")
    bad = "0x52908400098527886E0F7030069857D2E4169Ee7"

    result = validate_address(network, bad)
    assert result.valid is False
    assert "EIP-55" in (result.reason or "")


def test_bitcoin_base58check_address_is_network_scoped():
    address = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT"
    mainnet = validate_address(get_network("bitcoin-mainnet"), address)
    testnet = validate_address(get_network("bitcoin-testnet"), address)

    assert mainnet.valid is True
    assert testnet.valid is False


def test_solana_public_key_validation_is_preserved():
    result = validate_address(
        get_network("solana-mainnet-beta"),
        "11111111111111111111111111111111",
    )
    assert result.valid is True
    assert result.format == "solana-base58"


def test_watch_only_wallet_persists_chain_and_network_identity(tmp_path):
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    service = WalletService(AppState(vault))

    wallet = service.import_watch_only(
        address="0x52908400098527886e0f7030069857d2e4169ee7",
        label="Ethereum watch",
        chain="ethereum",
        network="mainnet",
    )

    assert wallet["watch_only"] is True
    assert wallet["chain"] == "ethereum"
    assert wallet["network"] == "mainnet"
    assert wallet["network_id"] == "ethereum-mainnet"
    assert wallet["signing_enabled"] is False
    assert wallet["broadcasting_enabled"] is False
    assert "secret_key_b58" not in wallet


def test_watch_only_import_rejects_address_for_wrong_network(tmp_path):
    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    service = WalletService(AppState(vault))

    try:
        service.import_watch_only(
            address="1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
            label="Wrong chain",
            chain="ethereum",
            network="mainnet",
        )
    except ValueError as exc:
        assert "EVM address" in str(exc)
    else:
        raise AssertionError("An address for the wrong network must be rejected")


def test_provider_summary_never_returns_secret_url_path(tmp_path):
    from backend.chains.service import ChainService

    vault = VaultManager(tmp_path / "vault.svault")
    vault.create("a-very-strong-password")
    vault.data().setdefault("chain_providers", {})["ethereum-mainnet"] = {
        "base_url": "https://rpc.example.invalid/v2/private-token",
        "api_key": "private-token",
    }
    summary = ChainService(AppState(vault)).provider_summary("ethereum-mainnet")

    assert summary["provider_host"] == "rpc.example.invalid"
    assert "base_url" not in summary
    assert "private-token" not in repr(summary)


def test_evm_adapter_reads_native_balance_and_checks_chain_id():
    import asyncio

    from backend.chains.adapters import EVMReadAdapter

    class FakeEVMAdapter(EVMReadAdapter):
        def __init__(self, network, chain_id="0x1"):
            super().__init__(network, {"base_url": "https://rpc.example.invalid"})
            self.remote_chain_id = chain_id

        async def request(self, method, path="", *, params=None, body=None):
            rpc_method = body["method"]
            return {
                "eth_chainId": self.remote_chain_id,
                "eth_getBalance": "0xde0b6b3a7640000",
                "eth_blockNumber": "0x10",
            }[rpc_method]

    network = get_network("ethereum-mainnet")
    adapter = FakeEVMAdapter(network)
    result = asyncio.run(adapter.sync_wallet({
        "address": "0x52908400098527886e0f7030069857d2e4169ee7",
        "token_contracts": [],
    }))
    assert result["balance"] == "1"
    assert result["native_asset"] == "ETH"
    assert result["chain_id"] == 1
    assert result["block_number"] == 16

    wrong_network = FakeEVMAdapter(network, chain_id="0xa")
    try:
        asyncio.run(wrong_network.sync_wallet({
            "address": "0x52908400098527886e0f7030069857d2e4169ee7",
        }))
    except Exception as exc:
        assert "chain ID mismatch" in str(exc)
    else:
        raise AssertionError("The EVM adapter must reject an RPC endpoint for the wrong chain")


def test_esplora_adapter_converts_satoshi_balances_without_float_math():
    import asyncio

    from backend.chains.adapters import EsploraReadAdapter

    class FakeEsploraAdapter(EsploraReadAdapter):
        async def request(self, method, path="", *, params=None, body=None):
            if path.endswith("/txs"):
                return [{"txid": "sample-tx", "status": {"confirmed": True, "block_height": 100, "block_time": 123}}]
            return {
                "chain_stats": {"funded_txo_sum": 150000000, "spent_txo_sum": 25000000},
                "mempool_stats": {"funded_txo_sum": 1000, "spent_txo_sum": 500},
            }

    adapter = FakeEsploraAdapter(get_network("bitcoin-mainnet"), {"base_url": "https://explorer.example.invalid/api"})
    result = asyncio.run(adapter.sync_wallet({"address": "1BoatSLRHtKNngkdXEeobR76b53LETtpyT"}))

    assert result["balance_raw"] == "125000000"
    assert result["balance"] == "1.25"
    assert result["unconfirmed_delta_raw"] == "500"
    assert result["activity"][0]["txid"] == "sample-tx"
