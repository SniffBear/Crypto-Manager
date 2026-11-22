from __future__ import annotations

import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from .deps import require_session
from ..core.vault import VaultError

router = APIRouter(prefix="/backups", tags=["backups"])


class RestoreRequest(BaseModel):
    name: str
    password: str = Field(min_length=10)
    confirm: bool = False


def _manifest_path(path: Path) -> Path:
    return path.with_suffix(path.suffix + ".manifest.json")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@router.post("/create")
async def create_backup(state=Depends(require_session)):
    backup_dir = Path(state.vault.path).parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target = backup_dir / f"vault-{stamp}.svault"
    state.vault.export_copy(target)

    manifest = {
        "name": target.name,
        "created_at": stamp,
        "bytes": target.stat().st_size,
        "sha256": _sha256(target),
        "format_version": state.vault.metadata()["format_version"],
        "kdf": state.vault.metadata()["kdf"],
    }
    _manifest_path(target).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    try:
        os.chmod(_manifest_path(target), 0o600)
    except OSError:
        pass
    return {
        "path": str(target),
        "created_at": stamp,
        "manifest": manifest,
    }


@router.get("")
async def list_backups(state=Depends(require_session)):
    folder = Path(state.vault.path).parent / "backups"
    if not folder.exists():
        return []
    items = []
    for path in sorted(folder.glob("*.svault"), reverse=True):
        manifest_path = _manifest_path(path)
        manifest = None
        if manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                manifest = None
        items.append(
            {
                "name": path.name,
                "size": path.stat().st_size,
                "manifest": manifest,
            }
        )
    retention = int(os.getenv("BACKUP_RETENTION_COUNT", "25"))
    if retention >= 1 and len(items) > retention:
        for stale in items[retention:]:
            stale_path = folder / stale["name"]
            stale_manifest = _manifest_path(stale_path)
            stale_path.unlink(missing_ok=True)
            stale_manifest.unlink(missing_ok=True)
        items = items[:retention]
    return items


@router.post("/verify")
async def verify_backup(
    name: str,
    response: Response,
    state=Depends(require_session),
):
    folder = Path(state.vault.path).parent / "backups"
    target = folder / Path(name).name
    if target.suffix != ".svault" or not target.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    manifest_path = _manifest_path(target)
    if not manifest_path.exists():
        return {"name": target.name, "valid": False, "detail": "Manifest not found"}

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"name": target.name, "valid": False, "detail": "Manifest is invalid"}

    actual = _sha256(target)
    valid = actual == manifest.get("sha256") and target.stat().st_size == manifest.get("bytes")
    response.headers["Cache-Control"] = "no-store"
    return {"name": target.name, "valid": valid, "sha256": actual}


@router.post("/restore")
async def restore_backup(
    body: RestoreRequest,
    response: Response,
    state=Depends(require_session),
):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Explicit restore confirmation is required")

    folder = Path(state.vault.path).parent / "backups"
    source = folder / Path(body.name).name
    if source.suffix != ".svault" or not source.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    try:
        blob = source.read_bytes()
        state.vault.validate_blob(blob, body.password)
    except VaultError as exc:
        raise HTTPException(status_code=400, detail="Backup password validation failed") from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail="Backup could not be read") from exc

    rollback_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    rollback = folder / f"pre-restore-{rollback_stamp}.svault"
    state.vault.export_copy(rollback)

    staging = state.vault.path.with_suffix(state.vault.path.suffix + ".restore-staging")
    try:
        shutil.copy2(source, staging)
        os.chmod(staging, 0o600)
        # The encrypted backup was fully decrypted above before the active
        # vault is changed, so a wrong password/corrupt file cannot replace it.
        os.replace(staging, state.vault.path)
    finally:
        if staging.exists():
            staging.unlink(missing_ok=True)

    state.vault.lock()
    state.revoke_sessions()
    response.headers["Cache-Control"] = "no-store"
    return {
        "restored": True,
        "name": source.name,
        "rollback_backup": rollback.name,
        "requires_unlock": True,
    }


@router.post("/rollback")
async def rollback_backup(
    name: str,
    password: str,
    response: Response,
    confirm: bool = False,
    state=Depends(require_session),
):
    if not confirm:
        raise HTTPException(status_code=400, detail="Explicit rollback confirmation is required")
    folder = Path(state.vault.path).parent / "backups"
    source = folder / Path(name).name
    if source.suffix != ".svault" or not source.exists():
        raise HTTPException(status_code=404, detail="Rollback backup not found")
    try:
        state.vault.validate_blob(source.read_bytes(), password)
    except VaultError as exc:
        raise HTTPException(status_code=400, detail="Rollback backup password validation failed") from exc

    staging = state.vault.path.with_suffix(state.vault.path.suffix + ".rollback-staging")
    try:
        shutil.copy2(source, staging)
        os.chmod(staging, 0o600)
        os.replace(staging, state.vault.path)
    finally:
        if staging.exists():
            staging.unlink(missing_ok=True)

    state.vault.lock()
    state.revoke_sessions()
    response.headers["Cache-Control"] = "no-store"
    return {
        "restored": True,
        "name": source.name,
        "requires_unlock": True,
    }


@router.delete("/{name}")
async def delete_backup(
    name: str,
    confirm: bool = False,
    state=Depends(require_session),
):
    if not confirm:
        raise HTTPException(status_code=400, detail="Explicit deletion confirmation is required")
    folder = Path(state.vault.path).parent / "backups"
    target = folder / Path(name).name
    if target.suffix != ".svault" or not target.exists():
        raise HTTPException(status_code=404, detail="Backup not found")
    target.unlink(missing_ok=True)
    _manifest_path(target).unlink(missing_ok=True)
    return {"deleted": target.name}