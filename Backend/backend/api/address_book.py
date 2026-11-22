from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .deps import require_session
from ..core.address_book import AddressBookService
from ..core.feature_suite import FeatureSuite

router = APIRouter(prefix="/address-book", tags=["address-book"])


class ContactCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=1, max_length=256)
    network: str = Field(default="solana", min_length=1, max_length=64)
    notes: str = Field(default="", max_length=500)
    trusted: bool = False


class ContactUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=80)
    notes: str | None = Field(default=None, max_length=500)
    trusted: bool | None = None


class RecipientCheck(BaseModel):
    address: str = Field(min_length=1, max_length=256)
    network: str = Field(default="solana", min_length=1, max_length=64)


@router.get("")
async def list_contacts(network: str | None = Query(default=None), state=Depends(require_session)):
    return AddressBookService(state).list(network)


@router.post("")
async def create_contact(body: ContactCreate, state=Depends(require_session)):
    try:
        return AddressBookService(state).add(**body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/{contact_id}")
async def update_contact(contact_id: str, body: ContactUpdate, state=Depends(require_session)):
    try:
        changes = {k: v for k, v in body.model_dump().items() if v is not None}
        return AddressBookService(state).update(contact_id, **changes)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, state=Depends(require_session)):
    try:
        AddressBookService(state).delete(contact_id)
        return {"deleted": True, "id": contact_id}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/check-recipient")
async def check_recipient(body: RecipientCheck, state=Depends(require_session)):
    try:
        return AddressBookService(state).recipient_status(body.address, body.network)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/settings/trusted-recipient-policy")
async def get_policy(state=Depends(require_session)):
    return {"require_new_recipient_confirmation": bool(FeatureSuite(state).get_policy()["require_new_recipient_confirmation"])}


class RecipientPolicy(BaseModel):
    require_new_recipient_confirmation: bool


@router.put("/settings/trusted-recipient-policy")
async def set_policy(body: RecipientPolicy, state=Depends(require_session)):
    settings = state.vault.data().setdefault("settings", {})
    settings["require_new_recipient_confirmation"] = body.require_new_recipient_confirmation
    FeatureSuite(state).set_policy({"require_new_recipient_confirmation": body.require_new_recipient_confirmation})
    return body.model_dump()