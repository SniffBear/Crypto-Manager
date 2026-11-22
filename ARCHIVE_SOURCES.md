# Archive Consolidation Notes

The source was consolidated from five user-provided RAR archives (not ZIP files):

| Uploaded archive | Disposition |
|---|---|
| `Main(2).rar` | Older backend and Expo/UI implementation reviewed for feature parity and reusable presentation patterns. Not copied wholesale because it overlaps with later sources. |
| `Main2.rar` | Near-duplicate intermediate snapshot; used for comparison, not duplicated into the final source tree. |
| `1a Main - Var1(1).rar` | Selected as the primary backend and Expo client baseline because it contains the most complete and recent API, sync, Token-2022, multisig-coordination, and navigation implementation. |
| `Frontend_Bot_ToCopy(1).rar` | Preserved separately under `DesktopLegacy/`; not merged into the API process because it is an independent Tkinter client with its own execution path. |
| `solana_vault_v6.rar` | Reviewed as an older desktop/vault snapshot. Superseded by newer source and not copied; wallet exports and backup material were intentionally excluded. |

Local environment files, backup directories, wallet exports, secret-bearing files, embedded Git metadata, virtual environments, dependency caches, compiled binaries, and oversized generated artifacts were excluded. Archive files themselves are not stored in the repository.