from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class Network:
    id: str
    chain: str
    family: str
    name: str
    network: str
    symbol: str
    decimals: int
    chain_id: int | None = None
    provider_kind: str = "custom"
    default_endpoint: str | None = None
    address_prefixes: tuple[int, ...] = ()
    bech32_hrp: str | None = None
    status: str = "PARTIAL"
    capabilities: tuple[str, ...] = ("watch_only", "address_validation")

    def public_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["address_prefixes"] = list(self.address_prefixes)
        result["capabilities"] = list(self.capabilities)
        return result


_NETWORKS = [
    Network("solana-mainnet-beta", "solana", "solana", "Solana Mainnet", "mainnet-beta", "SOL", 9, provider_kind="solana_rpc", status="IMPLEMENTED", capabilities=("wallet_create", "wallet_import", "watch_only", "native_balance", "token_balance", "activity", "reconciliation", "transaction_simulation")),
    Network("solana-devnet", "solana", "solana", "Solana Devnet", "devnet", "SOL", 9, provider_kind="solana_rpc", status="IMPLEMENTED", capabilities=("wallet_create", "wallet_import", "watch_only", "native_balance", "token_balance", "activity", "reconciliation", "transaction_simulation")),
    Network("solana-testnet", "solana", "solana", "Solana Testnet", "testnet", "SOL", 9, provider_kind="solana_rpc", status="IMPLEMENTED", capabilities=("wallet_create", "wallet_import", "watch_only", "native_balance", "token_balance", "activity", "reconciliation", "transaction_simulation")),

    Network("ethereum-mainnet", "ethereum", "evm", "Ethereum", "mainnet", "ETH", 18, 1, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("ethereum-sepolia", "ethereum", "evm", "Ethereum Sepolia", "sepolia", "ETH", 18, 11155111, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("ethereum-classic-mainnet", "ethereum-classic", "evm", "Ethereum Classic", "mainnet", "ETC", 18, 61, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("ethereum-classic-mordor", "ethereum-classic", "evm", "Ethereum Classic Mordor", "mordor", "ETC", 18, 63, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("base-mainnet", "base", "evm", "Base", "mainnet", "ETH", 18, 8453, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("base-sepolia", "base", "evm", "Base Sepolia", "sepolia", "ETH", 18, 84532, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("arbitrum-one", "arbitrum", "evm", "Arbitrum One", "mainnet", "ETH", 18, 42161, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("arbitrum-sepolia", "arbitrum", "evm", "Arbitrum Sepolia", "sepolia", "ETH", 18, 421614, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("optimism-mainnet", "optimism", "evm", "Optimism", "mainnet", "ETH", 18, 10, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("optimism-sepolia", "optimism", "evm", "Optimism Sepolia", "sepolia", "ETH", 18, 11155420, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("polygon-mainnet", "polygon", "evm", "Polygon PoS", "mainnet", "POL", 18, 137, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("polygon-amoy", "polygon", "evm", "Polygon Amoy", "amoy", "POL", 18, 80002, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("bsc-mainnet", "bsc", "evm", "BNB Smart Chain", "mainnet", "BNB", 18, 56, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),
    Network("bsc-testnet", "bsc", "evm", "BNB Smart Chain Testnet", "testnet", "tBNB", 18, 97, "evm_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "erc20_balance", "network_verification")),

    Network("bitcoin-mainnet", "bitcoin", "utxo", "Bitcoin", "mainnet", "BTC", 8, provider_kind="esplora", default_endpoint="https://blockstream.info/api", address_prefixes=(0x00, 0x05), bech32_hrp="bc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("bitcoin-testnet", "bitcoin", "utxo", "Bitcoin Testnet", "testnet", "tBTC", 8, provider_kind="esplora", default_endpoint="https://blockstream.info/testnet/api", address_prefixes=(0x6F, 0xC4), bech32_hrp="tb", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("litecoin-mainnet", "litecoin", "utxo", "Litecoin", "mainnet", "LTC", 8, provider_kind="blockbook", address_prefixes=(0x30, 0x32), bech32_hrp="ltc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("litecoin-testnet", "litecoin", "utxo", "Litecoin Testnet", "testnet", "tLTC", 8, provider_kind="blockbook", address_prefixes=(0x6F, 0x3A), bech32_hrp="tltc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("dogecoin-mainnet", "dogecoin", "utxo", "Dogecoin", "mainnet", "DOGE", 8, provider_kind="blockbook", address_prefixes=(0x1E, 0x16), status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("dogecoin-testnet", "dogecoin", "utxo", "Dogecoin Testnet", "testnet", "tDOGE", 8, provider_kind="blockbook", address_prefixes=(0x71, 0xC4), status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("ravencoin-mainnet", "ravencoin", "utxo", "Ravencoin", "mainnet", "RVN", 8, provider_kind="blockbook", address_prefixes=(0x3C, 0x7A), status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("ravencoin-testnet", "ravencoin", "utxo", "Ravencoin Testnet", "testnet", "tRVN", 8, provider_kind="blockbook", address_prefixes=(0x6F, 0xC4), status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),

    Network("ergo-mainnet", "ergo", "ergo", "Ergo", "mainnet", "ERG", 9, provider_kind="ergo_node", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance")),
    Network("ergo-testnet", "ergo", "ergo", "Ergo Testnet", "testnet", "tERG", 9, provider_kind="ergo_node", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance")),
    Network("kaspa-mainnet", "kaspa", "kaspa", "Kaspa", "mainnet", "KAS", 8, provider_kind="kaspa_rest", default_endpoint="https://api.kaspa.org", bech32_hrp="kaspa", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance")),
    Network("kaspa-testnet-10", "kaspa", "kaspa", "Kaspa Testnet-10", "testnet-10", "TKAS", 8, provider_kind="kaspa_rest", bech32_hrp="kaspatest", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance")),
    Network("monero-mainnet", "monero", "privacy_rpc", "Monero", "mainnet", "XMR", 12, provider_kind="monero_wallet_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("monero-testnet", "monero", "privacy_rpc", "Monero Testnet", "testnet", "XMR", 12, provider_kind="monero_wallet_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("monero-stagenet", "monero", "privacy_rpc", "Monero Stagenet", "stagenet", "XMR", 12, provider_kind="monero_wallet_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("zano-mainnet", "zano", "privacy_rpc", "Zano", "mainnet", "ZANO", 12, provider_kind="zano_wallet_rpc", status="PARTIAL", capabilities=("watch_only", "address_validation", "native_balance", "activity")),
    Network("zano-testnet", "zano", "privacy_rpc", "Zano Testnet", "testnet", "tZANO", 12, provider_kind="zano_wallet_rpc", status="PARTIAL", capabilities=("watch_only", "native_balance", "activity")),
]

NETWORKS = {item.id: item for item in _NETWORKS}


def get_network(network_id: str) -> Network:
    try:
        return NETWORKS[network_id]
    except KeyError as exc:
        raise KeyError(f"Unsupported network: {network_id}") from exc


def list_networks() -> list[dict[str, Any]]:
    return [item.public_dict() for item in _NETWORKS]


def get_chain_networks(chain: str) -> list[dict[str, Any]]:
    return [item.public_dict() for item in _NETWORKS if item.chain == chain]


def network_id_for(chain: str, network: str) -> str:
    if chain == "solana":
        return f"solana-{network}"
    aliases = {
        ("ethereum-classic", "mainnet"): "ethereum-classic-mainnet",
        ("polygon", "amoy"): "polygon-amoy",
        ("kaspa", "testnet"): "kaspa-testnet-10",
    }
    candidate = aliases.get((chain, network), f"{chain}-{network}")
    return candidate
