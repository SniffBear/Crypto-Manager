# Nexus Crypto Manager

A local-first Solana portfolio and wallet-management application assembled from the supplied project snapshots. The unified repository keeps the FastAPI backend, Expo client, and optional legacy desktop client separate. The current native wallet and transaction adapter is Solana-specific; see `FEATURE_STATUS.md` for exact capability boundaries.

> **Security notice:** This software is an actively developed engineering project, not an audited custody product. Keep live transaction broadcasting disabled, use disposable devnet wallets while testing, and never commit `.env` files, wallet keys, seed phrases, vault files, or backups.

## Repository layout

```text
Backend/         FastAPI service and Solana integrations
Frontend/        Expo Router app (React Native + web)
DesktopLegacy/   Optional Tkinter desktop client retained separately
DESIGN.md        Canonical product and UX design contract
SECURITY.md      Secret-handling and release guidance
AUDIT_NOTES.md   Consolidation changes and follow-up findings
ARCHIVE_SOURCES.md  Source archive provenance and disposition
```

## Features in the current development baseline

- Encrypted local vault with Argon2id for new vaults and legacy KDF migration support.
- Wallet create/import/watch-only workflows and explicit, re-authenticated secret export.
- Solana RPC pooling, provider adapters, health/failover and authenticated sync workers.
- Portfolio, assets, Token-2022 metadata support, activity, alerts, research, risk, strategies, accounting and local backups.
- Transaction construction and simulation with live broadcast disabled by default.
- Expo mobile/web interface with authenticated API sessions and WebSocket event updates.
- Wallet groups, recipient trust rules, spending policies, risk review scores and one-use simulation claims.
- Scheduled/recurring payment intents with manual approval, batch drafts, FIFO cost basis, P&L summaries and CSV exports.
- Payment requests, explorer links, transaction graph, read-only local assistant, alert-only limit orders and fee quote cache.
- Security alerts, vault audit events, automatic encrypted backups, SHA-256 backup verification and recovery checklist.
- Argon2id/AES-GCM encrypted metadata export/import and process-local session controls.

Feature availability is not uniform. Read `AUDIT_NOTES.md` and the UI capability map; do not assume every navigation item represents production-ready or on-chain functionality. In particular, multisig is currently off-chain proposal/signature coordination only.

## Quick start — backend

Requirements: Python 3.11+, pip.

```bash
cd Backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python -m backend.main
```

The API listens on `http://127.0.0.1:8000` by default. OpenAPI docs are at `http://127.0.0.1:8000/docs`; health check is `http://127.0.0.1:8000/health`. Backend data and the encrypted vault are stored under `Backend/data/` by default and are ignored by Git.

## Quick start — Expo client

Requirements: Node.js 22+ and npm.

```bash
cd Frontend
cp .env.example .env
npm ci
npm run start
```

Set `EXPO_PUBLIC_API_URL` to the backend URL reachable from the client. For Android emulator use `http://10.0.2.2:8000`; for a physical device use your development computer's LAN IP and add the corresponding frontend origin to backend configuration. Do not place secrets in Expo public variables.

## Optional legacy desktop client

See `DesktopLegacy/README.md`. It is deliberately separate: its signing/broadcast path does not use the FastAPI backend's live-execution feature gate. Do not use it with funded wallets without an independent security review.

## Tests and checks

Backend:

```bash
cd Backend
pytest -q
python -m compileall -q backend
```

Frontend:

```bash
cd Frontend
npm ci
npm run typecheck
npm run lint
npm test
```

Legacy desktop:

```bash
cd DesktopLegacy
pip install -r requirements.txt
pytest -q
```

GitHub Actions runs backend checks and frontend checks. CI success is required before promoting a release.

## Configuration and secrets

- Copy `Backend/.env.example` and `Frontend/.env.example` to local `.env` files.
- Provider credentials belong in the encrypted backend vault wherever supported.
- `ENABLE_LIVE_EXECUTION` is `false` in the example configuration. Keep it false.
- Do not upload the original RAR archives; one contains local environment configuration, another contains wallet export/backup material, and most contain bundled caches or Git metadata.

See `SECURITY.md`, `FEATURE_STATUS.md`, `CHANGELOG.md`, `ARCHIVE_SOURCES.md`, and `AUDIT_NOTES.md` before development or deployment.

### Address book and reconciliation

The encrypted vault now includes a network-aware address book with trusted-recipient flags and a configurable new-recipient confirmation policy. Solana transfer execution enforces the policy. A read-only reconciliation service refreshes Solana balances and activity, stores snapshots, and reports balance changes and newly detected transactions. Portfolio reconciliation retains the existing Solana path. A separate multi-chain chain registry and read-only wallet adapter layer now covers EVM native balances, Bitcoin Esplora, configured Blockbook UTXO endpoints, Ergo, Kaspa, and local Monero/Zano wallet RPCs. See FEATURE_STATUS.md for network-specific limits.


## Feature boundaries and roadmap

The feature-suite UI is available at `/s/feature-suite`. It exposes wallet groups, transaction policy, scheduled transfer intents, draft batches, FIFO accounting, payment requests, local assistant, limit-order alerts, explorer links, encrypted metadata sync, automatic backups, recovery checks, security alerts, sessions, portfolio analytics, network capability status, and export utilities. Scheduled items and limit orders do not automatically move funds. Batch items require separate individual simulation and authorization.

Solana remains the only network with key generation/import and transaction construction in this codebase. Additional EVM, UTXO, Ergo, Kaspa, Monero and Zano adapters are watch-only/read-only and require configured providers or local wallet RPCs as documented in FEATURE_STATUS.md. No non-Solana signing or broadcasting is implemented. Do not use these read-only integrations as a deposit or custody guarantee. Hardware-wallet integration is intentionally excluded. Cryptocurrency mining is not part of this application.

See `FEATURE_STATUS.md` for a detailed feature matrix and the distinction between implemented, partial and not-yet-implemented functionality.