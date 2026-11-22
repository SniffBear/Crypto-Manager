from __future__ import annotations

import asyncio
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

from ..core.feature_suite import FeatureSuite


class FeatureMaintenanceWorker:
    """Runs safe local maintenance; it never signs or broadcasts transactions."""
    def __init__(self, state, interval_seconds: int = 30) -> None:
        self.state = state
        self.interval = max(10, interval_seconds)
        self._stop = asyncio.Event()

    def _automatic_backup(self) -> dict:
        settings = self.state.vault.data().setdefault("settings", {})
        if not settings.get("automatic_backups_enabled"):
            return {"status": "DISABLED"}
        interval_hours = max(1, min(720, int(settings.get("automatic_backup_interval_hours", 24))))
        last = settings.get("last_automatic_backup_at")
        if last:
            try:
                previous = datetime.fromisoformat(last)
                if datetime.now(timezone.utc) - previous < timedelta(hours=interval_hours):
                    return {"status": "NOT_DUE"}
            except ValueError:
                pass
        folder = Path(self.state.vault.path).parent / "backups"
        folder.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        destination = folder / f"automatic-vault-{stamp}.svault"
        shutil.copy2(self.state.vault.path, destination)
        try: os.chmod(destination, 0o600)
        except OSError: pass
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        manifest = {"name": destination.name, "created_at": stamp, "bytes": destination.stat().st_size,
                    "sha256": digest, "kind": "automatic-encrypted-vault-copy"}
        manifest_path = destination.with_suffix(destination.suffix + ".manifest.json")
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        try: os.chmod(manifest_path, 0o600)
        except OSError: pass
        settings["last_automatic_backup_at"] = datetime.now(timezone.utc).isoformat()
        self.state.vault.save()
        retention = max(1, min(100, int(settings.get("automatic_backup_retention_count", 14))))
        files = sorted(folder.glob("automatic-vault-*.svault"), key=lambda p: p.stat().st_mtime, reverse=True)
        for stale in files[retention:]:
            stale.unlink(missing_ok=True)
            stale.with_suffix(stale.suffix + ".manifest.json").unlink(missing_ok=True)
        return {"status": "CREATED", "name": destination.name, "sha256": digest}

    async def run_once(self) -> dict:
        if not self.state.vault.unlocked:
            return {"status": "VAULT_LOCKED"}
        suite = FeatureSuite(self.state)
        due = suite.process_due()
        payments_updated = suite.refresh_payment_request_statuses()
        limits = suite.evaluate_limit_orders()
        backup = self._automatic_backup()
        if due["processed"] or payments_updated or limits["triggered_for_review"]:
            await self.state.emit("features.maintenance", {"due_schedules": due["processed"],
                "payment_requests_updated": payments_updated, "limit_orders_triggered": limits["triggered_for_review"]})
        return {"status": "OK", "due_schedules": due["processed"], "payment_requests_updated": payments_updated,
                "limit_orders": limits, "backup": backup, "broadcasted": 0}

    async def start(self) -> None:
        while not self._stop.is_set():
            try:
                await self.run_once()
            except Exception as exc:
                await self.state.emit("features.maintenance", {"status": "ERROR", "error": type(exc).__name__})
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                continue

    async def stop(self) -> None:
        self._stop.set()