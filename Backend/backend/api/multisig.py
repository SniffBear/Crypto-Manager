from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .deps import require_session
from ..core.multisig import MultisigService

router = APIRouter(prefix="/multisig", tags=["multisig"])


class CreateMultisig(BaseModel):
    name: str
    members: list[str] = Field(min_length=1)
    threshold: int = Field(ge=1)


class CreateProposal(BaseModel):
    multisig_id: str
    wallet_id: str
    transaction: dict[str, Any]


class ApproveProposal(BaseModel):
    member: str
    signature_b58: str


@router.get("")
async def list_multisig(state=Depends(require_session)):
    return MultisigService(state).wallets()


@router.post("")
async def create_multisig(body: CreateMultisig, state=Depends(require_session)):
    try:
        return MultisigService(state).create_wallet(**body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/proposals")
async def list_proposals(state=Depends(require_session)):
    return list(reversed(MultisigService(state).proposals()))


@router.post("/proposals")
async def create_proposal(body: CreateProposal, state=Depends(require_session)):
    try:
        return MultisigService(state).create_proposal(**body.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/proposals/{proposal_id}/approve")
async def approve_proposal(
    proposal_id: str,
    body: ApproveProposal,
    state=Depends(require_session),
):
    try:
        return MultisigService(state).approve(
            proposal_id=proposal_id,
            member=body.member,
            signature_b58=body.signature_b58,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))