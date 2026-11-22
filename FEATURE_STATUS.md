# Nexus Crypto Manager — Feature and Network Status

Last reviewed: 2026-11-22

Multi-chain wallet foundation is available on branch feat/multichain-wallet-foundation; these are partial read-only capabilities, not production custody support.

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

## Native network support matrix

| Network / family | Address / wallet | Read / balance | Activity | Send / sign | Reconciliation / swap |
|---|---|---|---|---|---|
| Solana mainnet/devnet/testnet | Existing native wallet generation, secret import and watch-only import | Existing Solana RPC sync | Existing Helius/RPC activity path | Existing Solana-only transaction construction/simulation; live broadcast remains disabled by default | Existing Solana reconciliation; Jupiter remains Solana-specific |
| Ethereum, Sepolia, Ethereum Classic/Mordor, Base, Arbitrum, Optimism, Polygon and BNB Chain | EVM address validation and watch-only import | Read-only native balance via JSON-RPC; chain ID checked against selected network | Not implemented | Disabled | No transaction history indexer or cross-chain swap |
| Bitcoin mainnet/testnet | Base58Check and Bech32 validation; watch-only import | Read-only balance via Esplora | First-page activity via Esplora | Disabled | No signing, UTXO construction or swap |
| Litecoin, Dogecoin and Ravencoin | Network-specific Base58Check/Bech32 checks; watch-only import | Read-only balance via user-configured Blockbook | First-page activity if supplied by Blockbook | Disabled | No signing, UTXO construction or swap |
| Ergo mainnet/testnet | Address checksum/network validation; watch-only import | Read-only balance via configured Ergo node/indexer API | Not implemented | Disabled | No signing or swap |
| Kaspa mainnet/testnet-10 | Bech32/HRP validation; watch-only import | Read-only balance via Kaspa REST | Not implemented | Disabled | No signing or swap |
| Monero mainnet/testnet/stagenet | CryptoNote Base58, prefix and Keccak checksum validation; watch-only registration linked to an already-open local view-only wallet RPC | Balance via local Monero wallet RPC after verifying loaded wallet address | Read-only transfer listing via wallet RPC | Disabled | No public-address balance lookup, key generation/import or signing |
| Zano mainnet/testnet | Syntax-only prefix check; authoritative address matching via local Zano wallet RPC | Read-only balance via local Zano wallet RPC after address matching | Not implemented | Disabled | No key generation/import, signing or swap |

**Capability boundary:** non-Solana support is watch-only and read-only. The EVM adapter reads native balances; ERC-20 balances are only queried for contract addresses explicitly present in a wallet record, and automatic token discovery is not implemented. UTXO activity is limited to provider-returned pages. Ergo/Kaspa history indexing is not implemented. Monero and Zano require a locally running native wallet RPC and cannot derive balances from a public address alone. Zano syntax checks are not cryptographic validation; the local wallet RPC performs the authoritative match.

Do not deposit funds to a non-Solana wallet unless you have independently verified the address, recovery material and native wallet workflow. This branch does not provide non-Solana key generation, signing or sending.

## Explicit exclusions and non-automated behavior

- Hardware-wallet integration is intentionally not implemented, per user request.
- Cryptocurrency mining and mining-hardware management are out of scope.
- The feature-suite services never sign or broadcast transactions.
- Scheduled transfers, recurring transfers, batch transfers and limit orders require manual review; none auto-execute.
- No cross-chain swap router or multi-provider exchange comparison is implemented.
- No automatic tax filing, jurisdiction-specific tax classification or complete historical chain import is claimed.
- Encrypted metadata sync is manual; no cloud relay is configured.

## Validation status for multi-chain branch

- The starting commit's reported baseline was 40 backend tests and 6 frontend source tests; that result predates this multi-chain implementation.
- New chain registry, address-validation, EVM adapter, Esplora adapter and capability-matrix tests have been added.
- Local execution of the updated backend and Expo suites has not been performed in the current implementation environment.
- GitHub Actions was triggered for the draft PR, but the available runs failed before executing any job steps (zero reported steps). Treat this as an unverified CI/runner failure, not as a passing build and not as a confirmed source-code failure.
- Run `pip install -r Backend/requirements-dev.txt && pytest -q && python -m compileall -q backend` from `Backend/`, and `npm ci && npm run typecheck && npm run lint && npm test` from `Frontend/` before merging.

This branch is an implementation/development baseline, not a security audit or production custody certification.
