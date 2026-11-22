from __future__ import annotations
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from .deps import require_session
from ..providers.registry import ProviderRegistry

router = APIRouter(prefix="/providers", tags=["providers"])

class ConfigureProvider(BaseModel):
    api_key: str | None = None
    base_url: str | None = None


def registry(state):
    reg = state.services.get("provider_registry")
    if not reg:
        reg = ProviderRegistry(state.vault.data().get("providers", {}))
        state.services["provider_registry"] = reg
    return reg

@router.get("")
async def list_providers(state=Depends(require_session)):
    return registry(state).summary()

@router.get("/health")
async def health(state=Depends(require_session)):
    return await registry(state).health()

@router.put("/{name}")
async def configure(name: str, body: ConfigureProvider, state=Depends(require_session)):
    if body.base_url:
        parsed = urlparse(body.base_url)
        local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
        if parsed.scheme != "https" and not local_http:
            raise HTTPException(status_code=400, detail="Provider base URL must use https")
        if parsed.username or parsed.password:
            raise HTTPException(status_code=400, detail="Provider base URL must not contain embedded credentials")
    try:
        registry(state).configure(name, api_key=body.api_key, base_url=body.base_url)
        state.vault.data().setdefault("providers", {})[name] = {"api_key": body.api_key, "base_url": body.base_url}
        state.vault.save()
        return {"name": name, "configured": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))