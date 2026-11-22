from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api import accounting, activity, address_book, alerts, assets, auth, backups, chains, execution, feature_suite, multisig, portfolio, providers, receive, reconciliation, research, risk, rpc, strategies, sync, vault, wallets, watchlists
from .core.state import AppState
from .core.vault import VaultManager
from .workers.activity_sync import ActivitySyncWorker
from .workers.alerts import AlertsWorker
from .workers.price_sync import PriceSyncWorker
from .workers.risk_sync import RiskSyncWorker
from .workers.wallet_sync import WalletSyncWorker
from .workers.strategies import StrategyWorker
from .workers.metadata_sync import MetadataSyncWorker
from .workers.reconciliation import PortfolioReconciliationWorker
from .workers.feature_maintenance import FeatureMaintenanceWorker

load_dotenv()


def build_app() -> FastAPI:
    data_dir = Path(os.getenv("SOLANA_VAULT_DATA_DIR", "./data")).resolve()
    vault_path = Path(os.getenv("SOLANA_VAULT_PATH", str(data_dir / "vault.svault")))
    frontend_origins = [
        x.strip()
        for x in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081",
        ).split(",")
        if x.strip()
    ]
    data_dir.mkdir(parents=True, exist_ok=True)
    vault_manager = VaultManager(vault_path)
    app_state = AppState(
        vault_manager,
        session_ttl_seconds=int(os.getenv("SESSION_TTL_SECONDS", str(8 * 60 * 60))),
        session_idle_seconds=int(os.getenv("SESSION_IDLE_SECONDS", str(30 * 60))),
        redis_url=os.getenv("REDIS_URL"),
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.sv = app_state
        worker_specs = [
            WalletSyncWorker(app_state, int(os.getenv("WALLET_SYNC_INTERVAL", "60"))),
            ActivitySyncWorker(app_state, int(os.getenv("ACTIVITY_SYNC_INTERVAL", "45"))),
            PriceSyncWorker(app_state, int(os.getenv("PRICE_SYNC_INTERVAL", "30"))),
            RiskSyncWorker(app_state, int(os.getenv("RISK_SYNC_INTERVAL", "60"))),
            AlertsWorker(app_state, int(os.getenv("ALERT_SYNC_INTERVAL", "20"))),
            StrategyWorker(app_state, int(os.getenv("STRATEGY_SYNC_INTERVAL", "30"))),
            MetadataSyncWorker(app_state, int(os.getenv("METADATA_SYNC_INTERVAL", "300"))),
            PortfolioReconciliationWorker(app_state, int(os.getenv("PORTFOLIO_RECONCILIATION_INTERVAL", "120"))),
            FeatureMaintenanceWorker(app_state, int(os.getenv("FEATURE_MAINTENANCE_INTERVAL", "30"))),
        ]
        tasks = [asyncio.create_task(w.start()) for w in worker_specs]
        try:
            yield
        finally:
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    app = FastAPI(title="Nexus Crypto Manager Backend", version="1.3.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=frontend_origins,
        allow_credentials=True,
        # Keep browser access constrained to the API verbs and headers the
        # app actually uses. Never combine wildcard origins with credentials.
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Nexus-Device-Name"],
    )

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(vault.router, prefix="/api/v1")
    app.include_router(wallets.router, prefix="/api/v1")
    app.include_router(chains.router, prefix="/api/v1")
    app.include_router(address_book.router, prefix="/api/v1")
    app.include_router(feature_suite.router, prefix="/api/v1")
    app.include_router(reconciliation.router, prefix="/api/v1")
    app.include_router(assets.router, prefix="/api/v1")
    app.include_router(portfolio.router, prefix="/api/v1")
    app.include_router(activity.router, prefix="/api/v1")
    app.include_router(receive.router, prefix="/api/v1")
    app.include_router(providers.router, prefix="/api/v1")
    app.include_router(rpc.router, prefix="/api/v1")
    app.include_router(alerts.router, prefix="/api/v1")
    app.include_router(watchlists.router, prefix="/api/v1")
    app.include_router(research.router, prefix="/api/v1")
    app.include_router(risk.router, prefix="/api/v1")
    app.include_router(strategies.router, prefix="/api/v1")
    app.include_router(backups.router, prefix="/api/v1")
    app.include_router(accounting.router, prefix="/api/v1")
    app.include_router(execution.router, prefix="/api/v1")
    app.include_router(multisig.router, prefix="/api/v1")
    app.include_router(sync.router, prefix="/api/v1")

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "vault_exists": app_state.vault.exists,
            "vault_locked": not app_state.vault.unlocked,
        }

    @app.websocket("/ws/events")
    async def events(ws: WebSocket):
        await ws.accept()
        try:
            # Authenticate inside the WebSocket message channel rather than
            # putting the session token into the URL where it can leak through
            # history, proxies or logs.
            raw = await asyncio.wait_for(ws.receive_json(), timeout=10)
            token = raw.get("token") if isinstance(raw, dict) else None
            if not isinstance(raw, dict) or raw.get("type") != "auth" or not app_state.validate_session(token):
                await ws.close(code=4401)
                return

            queue = await app_state.event_bus.subscribe()
            try:
                await ws.send_json(
                    {"kind": "connected", "data": {"vault_locked": not app_state.vault.unlocked}}
                )
                while True:
                    event = await queue.get()
                    await ws.send_json(event)
            finally:
                app_state.event_bus.unsubscribe(queue)
        except (WebSocketDisconnect, asyncio.TimeoutError):
            try:
                await ws.close(code=4401)
            except Exception:
                pass

    return app


app = build_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=os.getenv("BACKEND_HOST", "127.0.0.1"),
        port=int(os.getenv("BACKEND_PORT", "8000")),
        reload=False,
    )