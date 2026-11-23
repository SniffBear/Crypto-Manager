from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from .deps import require_session
from ..core.wallets import WalletService

router = APIRouter(prefix="/wallets", tags=["wallets"])


class CreateWallet(BaseModel):
    label: str
    group: str | None = None
    role: str = "standard"
    cold_storage: bool = False


class ImportSecret(BaseModel):
    secret_key: str
    label: str
    group: str | None = None


class ImportWatch(BaseModel):
    address: str
    label: str
    group: str | None = None
    chain: str = "solana"
    network: str = "mainnet-beta"


class ExportSecretRequest(BaseModel):
    password: str = Field(min_length=1)


@router.get("")
async def list_wallets(state=Depends(require_session)):
    return WalletService(state).list()


@router.get("/{wallet_id}")
async def get_wallet(wallet_id: str, state=Depends(require_session)):
    try:
        return WalletService(state).get(wallet_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("")
async def create_wallet(body: CreateWallet, state=Depends(require_session)):
    return WalletService(state).create(**body.model_dump())


@router.post("/import/secret")
async def import_secret(body: ImportSecret, state=Depends(require_session)):
    try:
        return WalletService(state).import_secret(**body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/import/watch-only")
async def import_watch(body: ImportWatch, state=Depends(require_session)):
    try:
        return WalletService(state).import_watch_only(**body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{wallet_id}/export-secret")
async def export_secret(
    wallet_id: str,
    body: ExportSecretRequest,
    response: Response,
    state=Depends(require_session),
):
    if not state.vault.verify_password(body.password):
        raise HTTPException(status_code=401, detail="Re-authentication failed")

    try:
        secret_key = WalletService(state).export_secret(wallet_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    # Never permit intermediaries or caches to retain this response.
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return {"wallet_id": wallet_id, "secret_key_b58": secret_key}