# Nexus Crypto Manager — Python Backend

This package is the backend foundation for moving Solana Vault from a Tkinter desktop UI to a **React/TypeScript frontend + FastAPI/Python backend**.

## Architecture

```text
React / TypeScript
        |
        v
FastAPI /api/v1
        |
        +-- Auth / Vault / Wallets / Assets / Portfolio
        +-- Activity / Receive / Providers / RPC
        +-- Alerts / Watchlists / Research / Risk
        +-- Strategies / Backups / Accounting / Execution
        |
        v
Core services + Provider adapters + RPC layer + Workers
        |
        +-- Helius
        +-- GMGN
        +-- DexScreener
        +-- Birdeye
        +-- Jupiter
        +-- RugCheck
        +-- Axiom
        +-- Bitquery
```

## Included

- Encrypted AES-256-GCM vault storage.
- PBKDF2-HMAC-SHA256 derivation with 600,000 iterations.
- Session-based API authentication.
- Wallet generation, secret-key import, and watch-only import.
- Server-side provider registry.
- RPC pool, rate limiting, and failover components.
- Portfolio, assets, activity, alerts, watchlists, research, risk, strategies, backups, accounting.
- Execution API with simulation + explicit confirmation gates.
- WebSocket event stream at `/ws/events`.
- Background worker components for wallet/activity/price/risk/alert synchronization.
- CORS configuration for a local React dev server.

## Run

```bash
python -m venv .venv
# Windows
.venv\\Scripts\\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env  # macOS/Linux

python -m backend.main
```

API docs will be available at:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/redoc`

## Important integration note

This backend is intentionally structured as the **Python service layer**, not as a copy of the old Tkinter widgets. The React frontend should call the `/api/v1/*` routes and subscribe to `/ws/events`.

Provider adapters are deliberately isolated from the UI. Provider-specific authenticated requests and live-chain execution can be wired into these adapters without exposing API keys or private keys to the browser.

The `execution` module currently includes the API contracts, permission checks, simulation path, explicit confirmation gate, activity/audit recording, and an adapter-pending state. It does **not** silently broadcast transactions.

## Security model

- Private keys remain in the encrypted vault and are never returned by normal wallet listing endpoints.
- The React app should never store private keys or provider secrets in localStorage.
- Provider credentials are configured server-side and persisted inside the encrypted vault payload.
- The WebSocket requires a valid API session token.
- Live execution should remain behind explicit confirmation and the existing wallet permission flags.

## Feature-suite services

- `GET/POST /api/v1/address-book` lists and creates network-scoped contacts.
- `PATCH/DELETE /api/v1/address-book/{contact_id}` updates trust state or removes a contact.
- `POST /api/v1/address-book/check-recipient` reports whether a destination is known/trusted and whether explicit confirmation is required.
- `GET/PUT /api/v1/address-book/settings/trusted-recipient-policy` reads or updates the new-recipient confirmation policy (enabled by default).
- `GET /api/v1/portfolio/reconciliation`, `/history`, and `POST /run` expose read-only reconciliation.

Contacts and reconciliation snapshots are stored in the encrypted vault payload. The existing periodic reconciliation worker remains Solana-specific. The separate chain registry exposes read-only network sync for supported EVM, UTXO, Ergo, Kaspa, Monero and Zano networks via chain-specific adapters; it does not provide non-Solana key generation, signing or broadcasting. Each adapter's limits are reported by the network capability API. The reconciliation worker runs while the vault is unlocked. It refreshes chain-derived balances and transaction activity, records balance deltas and newly discovered transaction IDs, and never signs or broadcasts transactions.

Before a live Solana transfer, the execution API now requires `confirm_new_recipient=true` when the destination is unknown or not marked trusted and the policy is enabled. A saved-but-untrusted contact still requires confirmation. Trusted contacts bypass only this additional recipient prompt; the normal transaction confirmation and signing controls remain in force.


The authenticated `/api/v1/features/*` namespace contains wallet groups, transaction policies and heuristic review scoring, scheduled/recurring payment intents, draft-only batches, FIFO cost-basis tracking, payment requests, explorer links, graph reporting, read-only assistant queries, provider-supplied fee quote caching, alert-only limit orders, encrypted metadata export/import, backup policies and hash checks, recovery checklist, session list/revocation, security alerts, audit export, network support matrix and transaction CSV export. These services do not sign or broadcast transactions.

The transaction execution layer claims each successful simulation once before attempting signing, preventing a reused simulation from being used for a second send. Live Solana broadcast remains disabled by default. The full network capability matrix is in the repository root `FEATURE_STATUS.md`; all requested non-Solana networks remain unimplemented. Hardware-wallet integration is intentionally excluded.