# Initial Consolidation Audit

## Selected application structure

- `Backend/`: FastAPI service, encrypted local vault, Solana RPC and provider adapters, sync workers, portfolio/research/risk/alerts, execution simulation, and APIs.
- `Frontend/`: Expo Router React Native + web application.
- `DesktopLegacy/`: optional standalone Tkinter client retained for comparison and backward compatibility; not wired into backend lifecycle.
- `DESIGN.md`: canonical product and interaction contract from the selected source snapshot.

## Changes applied during consolidation

1. Reconciled the WebSocket auth mismatch: the backend requires an initial `{ type: "auth", token }` frame, so the Expo client now opens `/ws/events` without query credentials and sends the token over the socket. It only marks the connection ready after the backend's authenticated `connected` event.
2. Tightened FastAPI CORS to explicit methods and headers rather than wildcards. Origins remain an operator-configured allowlist.
3. Rejected malformed/empty Base58 input and validate the public-key suffix on imported 64-byte Solana secret keys rather than silently truncating corrupted imports.
4. Corrected frontend capability labels: portfolio history is unavailable; live transfer/swap are partial because transaction broadcast is gated; multisig is an off-chain signature-coordination prototype, not an on-chain multisig program.
5. Added safe environment templates, a comprehensive ignore file, and security guidance.
6. Kept the older Tkinter GUI in its own compatibility directory because it has an independent wallet/execution lifecycle.

## Findings requiring follow-up review

- The `DesktopLegacy` GUI contains its own live signing/broadcast functionality. The backend's live-execution environment flag does not disable that separate application. It should remain optional and must receive a dedicated security review before live use.
- FastAPI live execution can be enabled by setting `ENABLE_LIVE_EXECUTION=true`; the repository default is false. This feature is not audited for custody or production use.
- Multisig currently coordinates off-chain Ed25519 approvals in application state. It does not deploy or execute a Solana on-chain multisig program.
- Verify provider URL/SSRF policies, RPC endpoint trust boundaries, endpoint-specific credential redaction, request-size limits, and production deployment controls before exposing the backend beyond localhost.
- Add an external signer/hardware wallet integration rather than relying on application-held key material for high-value wallets.
- Use devnet and disposable wallets to test transactions; no live transactions were sent as part of this consolidation.

## Verification status

The standalone desktop archive tests passed in the local review environment (13 passed, 4 skipped). The backend and Expo suites are retained, but a full dependency-installed test run is still required: the review environment did not have the complete Python Solana (`solders`) and Node/Expo dependency sets installed. CI is configured to run backend tests, Python compilation, frontend type checks, lint, tests, and web export after dependencies are installed.