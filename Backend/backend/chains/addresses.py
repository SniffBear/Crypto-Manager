from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from .registry import Network


@dataclass(frozen=True)
class AddressValidation:
    valid: bool
    network_id: str
    format: str
    reason: str | None = None

    def as_dict(self) -> dict:
        return {
            "valid": self.valid,
            "network_id": self.network_id,
            "format": self.format,
            "reason": self.reason,
        }


_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_BECH32_MAP = {char: index for index, char in enumerate(_BECH32)}
_CN_DECODE_LENGTHS = {2: 1, 3: 2, 5: 3, 6: 4, 7: 5, 9: 6, 10: 7, 11: 8}


def _b58decode(value: str) -> bytes:
    number = 0
    for char in value:
        if char not in _B58:
            raise ValueError("Invalid Base58 character")
        number = number * 58 + _B58.index(char)
    raw = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\x00" * (len(value) - len(value.lstrip("1"))) + raw


def _base58check_payload(value: str) -> tuple[int, bytes]:
    decoded = _b58decode(value)
    if len(decoded) < 5:
        raise ValueError("Address is too short")
    payload, checksum = decoded[:-4], decoded[-4:]
    expected = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    if checksum != expected:
        raise ValueError("Address checksum mismatch")
    if len(payload) != 21:
        raise ValueError("Base58Check address payload must contain a one-byte version and 20-byte hash")
    return payload[0], payload[1:]


def _bech32_polymod(values: list[int]) -> int:
    generators = (0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3)
    chk = 1
    for value in values:
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ value
        for index, generator in enumerate(generators):
            if (top >> index) & 1:
                chk ^= generator
    return chk


def _bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(char) >> 5 for char in hrp] + [0] + [ord(char) & 31 for char in hrp]


def _decode_bech32(value: str) -> tuple[str, int]:
    if not value or value.lower() != value and value.upper() != value:
        raise ValueError("Mixed-case Bech32 address")
    value = value.lower()
    separator = value.rfind("1")
    if separator < 1 or separator + 7 > len(value):
        raise ValueError("Invalid Bech32 separator or length")
    hrp = value[:separator]
    try:
        data = [_BECH32_MAP[char] for char in value[separator + 1:]]
    except KeyError as exc:
        raise ValueError("Invalid Bech32 character") from exc
    check = _bech32_polymod(_bech32_hrp_expand(hrp) + data)
    if check not in (1, 0x2BC830A3):
        raise ValueError("Bech32 checksum mismatch")
    return hrp, check


def _decode_cn_block(text: str, output_size: int) -> bytes:
    number = 0
    for char in text:
        if char not in _B58:
            raise ValueError("Invalid CryptoNote Base58 character")
        number = number * 58 + _B58.index(char)
    if number >= 1 << (8 * output_size):
        raise ValueError("CryptoNote Base58 block overflow")
    return number.to_bytes(output_size, "big")


def _decode_cryptonote_base58(value: str) -> bytes:
    result = bytearray()
    for offset in range(0, len(value), 11):
        block = value[offset:offset + 11]
        size = 8 if len(block) == 11 else _CN_DECODE_LENGTHS.get(len(block))
        if size is None:
            raise ValueError("Invalid CryptoNote Base58 block length")
        result.extend(_decode_cn_block(block, size))
    return bytes(result)


def _validate_monero(address: str, network: str) -> None:
    try:
        from Crypto.Hash import keccak
    except ImportError as exc:
        raise ValueError("PyCryptodome is required for Monero checksum validation") from exc
    decoded = _decode_cryptonote_base58(address)
    if len(decoded) not in (69, 77):
        raise ValueError("Invalid Monero address payload length")
    prefixes = {
        "mainnet": {18, 19, 42},
        "testnet": {53, 54, 63},
        "stagenet": {24, 25, 36},
    }.get(network, set())
    if not decoded or decoded[0] not in prefixes:
        raise ValueError("Address prefix does not match the selected Monero network")
    digest = keccak.new(digest_bits=256)
    digest.update(decoded[:-4])
    if digest.digest()[:4] != decoded[-4:]:
        raise ValueError("Monero address checksum mismatch")


def validate_address(network: Network, address: str) -> AddressValidation:
    address = address.strip()
    if not address:
        return AddressValidation(False, network.id, "unknown", "Address is empty")

    try:
        if network.family == "evm":
            if not re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
                raise ValueError("Expected a 20-byte 0x-prefixed EVM address")
            body = address[2:]
            if body.lower() != body and body.upper() != body:
                from Crypto.Hash import keccak

                digest = keccak.new(digest_bits=256)
                digest.update(body.lower().encode("ascii"))
                checksum = digest.hexdigest()
                expected = "".join(
                    char.upper() if char in "abcdef" and int(checksum[index], 16) >= 8 else char
                    for index, char in enumerate(body.lower())
                )
                if body != expected:
                    raise ValueError("Mixed-case EVM address has an invalid EIP-55 checksum")
            return AddressValidation(True, network.id, "evm-hex")

        if network.chain == "monero":
            _validate_monero(address, network.network)
            return AddressValidation(True, network.id, "cryptonote-base58")

        if network.chain == "zano":
            # Zano's own wallet RPC remains authoritative. This only checks
            # the documented public/integrated address shape; sync verifies
            # the address against the locally opened Zano wallet.
            if not re.fullmatch(r"(?:Zx|iZ)[1-9A-HJ-NP-Za-km-z]{88,110}", address):
                raise ValueError("Address does not match the Zano address format")
            return AddressValidation(
                True, network.id, "zano-syntax-only",
                "Syntax checked only; native Zano wallet RPC verification is required",
            )

        if network.family == "utxo":
            if network.bech32_hrp and address.lower().startswith(network.bech32_hrp + "1"):
                hrp, _ = _decode_bech32(address)
                if hrp != network.bech32_hrp:
                    raise ValueError("Bech32 human-readable prefix does not match the network")
                return AddressValidation(True, network.id, "bech32")
            version, _ = _base58check_payload(address)
            if version not in network.address_prefixes:
                raise ValueError("Address version does not match the selected network")
            return AddressValidation(True, network.id, "base58check")

        if network.chain == "ergo":
            decoded = _b58decode(address)
            if len(decoded) < 6:
                raise ValueError("Ergo address is too short")
            payload, checksum = decoded[:-4], decoded[-4:]
            expected = hashlib.blake2b(payload, digest_size=32).digest()[:4]
            if checksum != expected:
                raise ValueError("Ergo address checksum mismatch")
            expected_prefix = 0 if network.network == "mainnet" else 1
            if (payload[0] >> 4) != expected_prefix:
                raise ValueError("Ergo address network prefix mismatch")
            return AddressValidation(True, network.id, "ergo-base58")

        if network.chain == "kaspa":
            hrp, _ = _decode_bech32(address)
            if hrp != network.bech32_hrp:
                raise ValueError("Kaspa address network prefix mismatch")
            return AddressValidation(True, network.id, "kaspa-bech32")

        if network.chain == "solana":
            if len(_b58decode(address)) != 32:
                raise ValueError("Solana public addresses must decode to 32 bytes")
            return AddressValidation(True, network.id, "solana-base58")

        raise ValueError("Address validation is not implemented for this network")
    except ValueError as exc:
        return AddressValidation(False, network.id, "invalid", str(exc))
