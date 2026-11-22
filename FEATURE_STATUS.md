# Nexus Crypto Manager — Feature and Network Status

Last reviewed: 2026-11-22

This document distinguishes working local features from integrations that still require chain-specific code, infrastructure, or provider credentials. A feature marked partial must not be interpreted as production-grade support for moving funds.

## Implemented in this branch

| Area | Implementation | Boundary |
|---|---|---|
| Wallet organization | Encrypted-vault wallet groups and member assignment | Uses the wallet records already supported by the active wallet engine |
| Address book | Network-scoped contacts, trusted-recipient flags, labels, notes and duplicate checks | For non-Solana networks, address validation is not chain-native; it is not proof that an address is valid |
| Transfer policy | New-recipient approval, trusted-only mode, cooldown, per-transaction and daily caps, fee-ratio warning, high-value second confirmation | Enforcement is wired into the existing Solana execution API; other native send adapters do not exist yet |
| Risk scoring | Explainable heuristic score and factors returned by the transfer evaluation endpoint | Review aid only; not AML screening, fraud detection or an address reputation guarantee |
| Transaction replay control | A successful simulation may be claimed once, under the process mutex, before signing/broadcasting | A failed post-claim attempt requires a fresh simulation |
| Scheduled/recurring payments | Durable transfer intents with due processing and manual approval states | Never automatically signs or broadcasts; approval prepares the item for a manual execution workflow |
| Batch transfers | Validate and save batch drafts | Does not construct, sign or broadcast a batch transaction |
| Cost basis | User-entered FIFO lots, disposal matching, realized/unrealized P&L and CSV export | Not automatically imported from exchanges or non-Solana chains; not tax advice |
| Payment requests | Address/amount request, expiry and matching against indexed activity | Automatic payment detection is limited to the current Solana-shaped indexed activity data |
| Portfolio analytics | Aggregated locally synchronized balances, allocation and FIFO P&L totals | Depends on latest stored balance/price data; stale/missing data is shown as such |
| Security alerts | Review alerts for failed executions, long-pending broadcasts and use of untrusted destinations; acknowledge/dismiss state | Heuristic review alerts; no claim of fraud certainty |
| Audit log | Vault-persisted security events for sensitive feature-suite operations | Local vault scope; no remote SIEM integration |
| Encrypted backups | Optional scheduled copies of the encrypted vault with SHA-256 manifests and retention | A matching hash proves file integrity only; it does not prove the password or recovery material works |
| Recovery checklist | Local checklist and backup inventory | Automated restore drill is not implemented; manually test against a separate vault copy |
| Metadata sync | Argon2id + AES-GCM encrypted export/import for selected metadata | Manual copy/export/import; no cloud sync; private keys and vault secrets are excluded |
| Sessions/devices | List/revoke active sessions held by this backend process | In-memory process-local sessions; not remote device-management infrastructure |
| Wallet graph | Graph from the currently indexed activity records | Current activity indexer is Solana-specific |
| Local assistant | Deterministic read-only answers from local vault summaries | Not a generative AI model; cannot sign, send or trade |
| Explorer links | Network-specific URL templates for supported explorer hosts | External links only; the application does not verify explorer contents or provider uptime |
| Fee quotes | Cache and display provider-supplied fee quotes with expiry | No fallback estimates are invented; a live provider quote is not wired for every network |
| Limit orders | Store price-trigger conditions and trigger manual-review alerts | Alert-only; never submits exchange orders |
| Transaction export | Local execution-history CSV | Includes records known to this application, not a complete tax or chain ledger |
| Swap history | Locally recorded swap/execution records | Active swap quote/build integration is currently Solana/Jupiter-specific |
| Clipboard safety | Manual on-demand compare of clipboard content with expected destination | No background clipboard watcher; cannot prove address ownership |

## Native network support matrix

| Network | Read/balance | Send/sign | Reconciliation | Swap |
|---|---|---|---|---|
| Solana (SOL and supported tokens) | Implemented via existing sync providers | Transaction construction/simulation implemented; live broadcast is disabled by default and gated by configuration | Implemented through the current Solana sync adapter | Jupiter integration only when configured |
| Bitcoin (BTC) | Not implemented | Not implemented | Not implemented | Not implemented |
| Litecoin (LTC) | Not implemented | Not implemented | Not implemented | Not implemented |
| Dogecoin (DOGE) | Not implemented | Not implemented | Not implemented | Not implemented |
| Monero (XMR) | Not implemented | Not implemented | Not implemented | Not implemented |
| Zano (ZANO) | Not implemented | Not implemented | Not implemented | Not implemented |
| Ethereum Classic (ETC) | Not implemented | Not implemented | Not implemented | Not implemented |
| Ravencoin (RVN) | Not implemented | Not implemented | Not implemented | Not implemented |
| Ergo (ERG) | Not implemented | Not implemented | Not implemented | Not implemented |
| Kaspa (KAS) | Not implemented | Not implemented | Not implemented | Not implemented |

A non-Solana address-book record or explorer link does not mean a native wallet adapter exists. Do not deposit funds to an address expecting Nexus to monitor or manage that network until its adapter appears as implemented and passes network-specific integration tests.

## Explicit exclusions and non-automated behavior

- Hardware-wallet integration is intentionally not implemented, per user request.
- Cryptocurrency mining and mining-hardware management are out of scope.
- The feature-suite services never sign or broadcast transactions.
- Scheduled transfers, recurring transfers, batch transfers and limit orders require manual review; none auto-execute.
- No cross-chain swap router or multi-provider exchange comparison is implemented.
- No automatic tax filing, jurisdiction-specific tax classification or complete historical chain import is claimed.
- Encrypted metadata sync is manual; no cloud relay is configured.

## Validation run for this branch

- Backend: `python -m pytest -q` — 40 passed.
- Backend bytecode compilation: `python -m compileall -q backend` — passed.
- Frontend source tests: `npm test` — 6 passed.
- Frontend typecheck/lint: not verified in this environment because `node_modules`/Expo packages are not installed. Run `npm ci`, then `npm run typecheck` and `npm run lint` before release.

This is an implementation/development baseline, not a security audit or production custody certification.