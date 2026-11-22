from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request

from .deps import get_state, require_session
from ..core.vault import VaultError
from pydantic import BaseModel, Field

router = APIRouter(prefix="/auth", tags=["auth"])


class PasswordRequest(BaseModel):
    password: str = Field(min_length=10)


@router.get("/status")
async def status(state=Depends(get_state)):
    return {
        "vault": state.vault.metadata(),
        "authenticated_sessions": len(state.sessions),
        "unlock_retry_after": await state.unlock_rate_limiter.retry_after("vault-unlock"),
    }


@router.post("/setup")
async def setup(body: PasswordRequest, request: Request, state=Depends(get_state)):
    try:
        state.vault.create(body.password)
        await state.unlock_rate_limiter.reset("vault-unlock")
        state.record_unlock_success()
        device_name = request.headers.get("x-nexus-device-name", "Nexus Crypto Manager client")
        session = state.create_session(device_name=device_name)
        state.vault.data().setdefault("security_events", []).append({"id": secrets.token_hex(10), "action": "vault.unlocked", "subject": session.session_id, "details": {}, "created_at": session.created_at.isoformat()})
        state.vault.save()
        return {
            "token": session.token,
            "expires_at": session.expires_at.isoformat(),
            "vault": state.vault.metadata(),
        }
    except VaultError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/unlock")
async def unlock(body: PasswordRequest, request: Request, state=Depends(get_state)):
    retry_after = await state.unlock_rate_limiter.retry_after("vault-unlock")
    if retry_after > 0:
        raise HTTPException(
            status_code=429,
            detail="Unlock temporarily rate limited. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        state.vault.unlock(body.password)
        await state.unlock_rate_limiter.reset("vault-unlock")
        state.record_unlock_success()
        state.revoke_sessions()
        device_name = request.headers.get("x-nexus-device-name", "Nexus Crypto Manager client")
        session = state.create_session(device_name=device_name)
        state.vault.data().setdefault("security_events", []).append({"id": secrets.token_hex(10), "action": "vault.unlocked", "subject": session.session_id, "details": {}, "created_at": session.created_at.isoformat()})
        state.vault.save()
        return {
            "token": session.token,
            "expires_at": session.expires_at,
            "vault": state.vault.metadata(),
        }
    except VaultError as exc:
        retry_after = await state.unlock_rate_limiter.record_failure("vault-unlock")
        raise HTTPException(
            status_code=401,
            detail=str(exc),
            headers={"Retry-After": str(retry_after)},
        )


@router.post("/lock")
async def lock(state=Depends(require_session)):
    state.vault.lock()
    state.revoke_sessions()
    return {"locked": True}