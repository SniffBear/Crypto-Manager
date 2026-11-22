from __future__ import annotations

from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .deps import require_session
from ..rpc.pool import RPCPool

router = APIRouter(prefix="/rpc", tags=["rpc"])


def pool(state):
    if "rpc_pool" not in state.services:
        state.services["rpc_pool"] = RPCPool(state.vault.data().get("rpc", {}).get("networks", []))
    return state.services["rpc_pool"]


class AddRPC(BaseModel):
    url: str = Field(min_length=8)
    network: str = "mainnet-beta"
    metadata: dict = Field(default_factory=dict)


@router.get("")
async def list_rpc(
    probe: bool = Query(default=True),
    state=Depends(require_session),
):
    current = pool(state)
    if probe:
        return await current.probe_all()
    return current.list()


@router.post("")
async def add_rpc(body: AddRPC, state=Depends(require_session)):
    parsed = urlparse(body.url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="RPC URL must use http or https")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="RPC URL must not contain embedded credentials")
    item = pool(state).add(**body.model_dump())
    state.vault.data().setdefault("rpc", {}).setdefault("networks", []).append(item)
    state.vault.save()
    # Return the endpoint metadata, but do not pretend the newly added endpoint
    # is healthy until a real probe has succeeded.
    return item


@router.delete("")
async def remove_rpc(url: str, state=Depends(require_session)):
    pool(state).remove(url)
    state.vault.data().setdefault("rpc", {})["networks"] = [
        x
        for x in state.vault.data().get("rpc", {}).get("networks", [])
        if x.get("url") != url
    ]
    state.vault.save()
    return {"removed": url}