# Changelog

## 1.3.0 — Feature suite expansion

- Added vault-backed wallet groups, recipient/spending rules, explicit risk scores and a one-use simulation claim to reduce duplicate-send risk.
- Added scheduled and recurring transfer intents that stop at manual approval, plus non-broadcasting batch drafts.
- Added user-entered FIFO cost-basis accounting, realized/unrealized P&L summaries and CSV exports.
- Added payment requests, explorer links, wallet graph reporting and a local read-only portfolio assistant.
- Added encrypted metadata-only sync bundles, automatic encrypted vault backups, backup hash verification and a recovery checklist.
- Added local security review alerts, acknowledgement state, session revocation, audit logging and a network capability matrix.
- Added alert-only limit orders, fee-quote cache display, recorded swap history and transaction CSV export.
- Added frontend panels for network readiness, security alerts, backup integrity and transaction/exchange history.
- Hardware wallet integration intentionally excluded. Mining remains out of scope.
- Native network adapters beyond Solana remain explicitly unimplemented; see `FEATURE_STATUS.md`.