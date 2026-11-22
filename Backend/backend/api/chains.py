from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .deps import require_session
from ..chains.registry import get_network
from ..chains.service import ChainService


router = APIRouter(prefix="/chains", tags=["chains"])


class ValidateAddress(BaseModel):
    address: str = Field(min_length=1, max_length=256)


class ConfigureChainProvider(BaseModel):
    base_url: str = Field(min_length=8, max_length=2048)
    api_key: str | None = Field(default=None, max_length=2048)
    api_key_header: str | None = Field(default=None, max_length=64)
    username: str | None = Field(default=None, max_length=256)
    password: str | None = Field(default=None, max_length=1024)
    wallet_address: str | None = Field(default=None, max_length=256)


class SyncChainWallet(BaseModel):
    wallet_id: str = Field(min_length=1, max_length=64)


def _validate_provider_url(network_id: str, value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Provider URL must use HTTP or HTTPS")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise HTTPException(status_code=400, detail="Provider URL cannot embed credentials, query strings or fragments")
    try:
        ip = ipaddress.ip_address(parsed.hostname)
    except ValueError:
        ip = None
    loopback = parsed.hostname in {"localhost"} or (ip is not None and ip.is_loopback)
    if parsed.scheme == "http" and not loopback:
        raise HTTPException(status_code=400, detail="Non-local provider endpoints must use HTTPS")
    if ip is not None and (ip.is_private or ip.is_link_local or ip.is_reserved) and not loopback:
        raise HTTPException(status_code=400, detail="Private and link-local provider addresses are not permitted")
    network = get_network(network_id)
    if network.family == "privacy_rpc" and not loopback:
        raise HTTPException(status_code=400, detail="Privacy wallet RPC must bind to localhost")
    return value.rstrip("/")


@router.get("")
async def networks(state=Depends(require_session)):
    return ChainService(state).networks()


@router.get("/{network_id}")
async def network_details(network_id: str, state=Depends(require_session)):
    try:
        network = get_network(network_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Network not found") from exc
    service = ChainService(state)
    return {**network.public_dict(), "provider": service.provider_summary(network_id)}


@router.post("/validate-address")
async def validate_address(body: ValidateAddress, network_id: str, state=Depends(require_session)):
    try:
        result = ChainService(state).validate(network_id, body.address)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Network not found") from exc
    return result


@router.get("/{network_id}/provider")
async def get_provider(network_id: str, state=Depends(require_session)):
    try:
        return ChainService(state).provider_summary(network_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Network not found") from exc


@router.put("/{network_id}/provider")
async def configure_provider(
    network_id: str,
    body: ConfigureChainProvider,
    state=Depends(require_session),
):
    try:
        network = get_network(network_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Network not found") from exc
    base_url = _validate_provider_url(network_id, body.base_url)
    allowed_headers = {None, "x-api-key", "api-key", "X-API-KEY", "Authorization"}
    if body.api_key_header not in allowed_headers:
        raise HTTPException(status_code=400, detail="Unsupported provider API-key header")
    if network.family == "privacy_rpc" and not body.username:
        raise HTTPException(status_code=400, detail="Privacy wallet RPC requires an authenticated local endpoint")
    config = {
        "base_url": base_url,
        "api_key": body.api_key,
        "api_key_header": body.api_key_header or "x-api-key",
        "username": body.username,
        "password": body.password,
        "wallet_address": body.wallet_address,
    }
    state.vault.data().setdefault("chain_providers", {})[network_id] = config
    state.vault.save()
    return {"network_id": network_id, "configured": True, "base_url": base_url, "credentials_stored": True}


@router.post("/{network_id}/sync")
async def sync_wallet(network_id: str, body: SyncChainWallet, state=Depends(require_session)):
    try:
        return await ChainService(state).sync_wallet(body.wallet_id, network_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # Do not return provider URLs, headers, credentials or raw RPC payloads.
        raise HTTPException(status_code=502, detail=f"Chain synchronization failed: {type(exc).__name__}") from exc


@router.get("/{network_id}/health")
async def provider_health(network_id: str, state=Depends(require_session)):
    try:
        return await ChainService(state).provider_health(network_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Network not found") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Provider health check failed: {type(exc).__name__}") from exc
