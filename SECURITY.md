# Security Policy

## Scope and current operating mode

This repository handles sensitive cryptocurrency wallet material. Treat it as a local-first application. The backend encrypts wallet data at rest; this does not make source-control uploads of secrets safe. Live transaction broadcasting in the FastAPI application is disabled by default (`ENABLE_LIVE_EXECUTION=false`). The separate `DesktopLegacy` GUI has its own execution code and is not protected by that backend feature flag.

## Never commit

- `.env` files or provider API credentials
- seed phrases, private keys, raw wallet exports, keystores, or encrypted vault files
- backup archives, local databases, logs, runtime state, or private certificates
- build outputs, virtual environments, dependency caches, or personal test data

The root `.gitignore` blocks common forms, but every commit must still be reviewed before push. If a secret is committed, consider it compromised: revoke/rotate the credential or move funds to a new wallet; deleting the file in a later commit does not remove it from Git history.

## Reporting

Do not file public issues containing wallet information, API tokens, or exploitable details. Contact the repository owner privately.

## Feature-suite safeguards

- Scheduled transfers and recurring payments stop in a manual-review state; they never broadcast automatically.
- Batch transfer support currently saves a draft only; there is no batch signer or broadcaster.
- Limit-order conditions generate manual alerts only; they do not submit trades.
- The metadata sync envelope includes selected metadata only and is protected with Argon2id and AES-GCM. It excludes private keys and vault secrets.
- Backup SHA-256 verification detects file changes relative to the saved manifest; it does not prove that the vault password or seed phrases can restore funds. Test recovery in a separate data directory.
- Risk scores and security alerts are heuristic review aids, not fraud guarantees.
- Only current Solana sync and execution paths have chain-native integration. Explorer templates and address book entries for other networks do not imply native wallet support.
- Hardware-wallet integration is intentionally excluded.

## Before enabling live execution

Perform an independent review of transaction construction, signer isolation, destination/amount validation, simulation freshness, replay protection, fee/slippage bounds, RPC endpoint trust, rate limiting, audit logging, and recovery procedures. Test on devnet with disposable wallets first. The current application is a development baseline, not a security-audited custody product.