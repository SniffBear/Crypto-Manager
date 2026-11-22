from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request


def get_state(request: Request):
    return request.app.state.sv


def get_session_token(authorization: str | None = Header(default=None)) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def require_session(request: Request, token: str | None = Depends(get_session_token)):
    state = request.app.state.sv
    if not state.validate_session(token):
        raise HTTPException(status_code=401, detail="Authentication required")
    if not state.vault.unlocked:
        raise HTTPException(status_code=423, detail="Vault is locked")
    return state