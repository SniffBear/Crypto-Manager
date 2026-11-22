from __future__ import annotations

from backend.chains.addresses import validate_address
from backend.chains.registry import NETWORKS, get_network, list_networks, network_id_for
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
