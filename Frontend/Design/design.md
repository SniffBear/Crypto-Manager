# Solana Vault — DESIGN.md
**Status:** Authoritative frontend/product design specification  
**Repository structure:** `/Backend/` + `/Frontend/`  
**Frontend target:** React Native + Expo + TypeScript  
**Primary frontend directory:** `/Frontend/`  
**Backend directory:** `/Backend/`  
**Current blockchain scope:** Solana only  
**Product character:** Wallet-first self-custody vault with professional digital-asset terminal capabilities  
**Design authority:** This document takes precedence over older UI patterns, legacy trading-oriented screens, or conflicting styling found elsewhere in the repository.
---
## 1. Design Authority & Repository Rules
The attached `DESIGN.md` is the authoritative visual, interaction, and product-direction specification for the application.
The repository is intentionally separated into two top-level systems:
```text
/
├── Backend/
│   └── Existing Python / FastAPI application
│
└── Frontend/
    └── React Native / Expo application
```
### Backend rules
The existing `/Backend/` application is the source of truth for:
- API contracts
- business logic
- wallet/vault state
- permissions
- provider integrations
- RPC infrastructure
- synchronization
- alerts
- risk state
- execution capabilities
- transaction state
- authoritative timestamps/statuses
The frontend must not replace, redesign, duplicate, or silently reimplement backend business logic.
### Frontend rules
The `/Frontend/` application owns:
- presentation
- navigation
- responsive layout
- local UI state
- interaction patterns
- filtering/sorting presentation
- charts/visualization
- safe non-sensitive preferences
- user-facing status communication
The frontend must consume actual backend contracts. It must never invent API endpoints, request bodies, response fields, event types, capabilities, or execution states merely because they would be useful.
When backend functionality does not exist, the UI must show an unavailable, unsupported, planned, or future state rather than fabricating functionality.
---
## 2. Product Identity
### Core identity
Solana Vault is a **professional, security-focused, wallet-first digital-asset application** for:
- generating wallets
- importing wallets
- securely storing wallets
- organizing wallets
- receiving assets
- monitoring incoming activity
- discovering assets
- tracking portfolios
- monitoring health and security
- managing providers and RPC infrastructure
- maintaining backups
- maintaining accounting information
- investigating assets and wallets
- monitoring alerts and risk
The application may borrow the **precision, density, responsiveness, and operational clarity of a professional trading terminal**, but the core product remains a wallet/vault rather than a casino-style trading application.
### Immediate questions the application should answer
A user should quickly understand:
1. **What wallets do I have?**
2. **What do those wallets contain?**
3. **Where are my assets?**
4. **Is my vault healthy and secure?**
5. **Are any wallets, assets, providers, RPCs, or alerts requiring attention?**
6. **What happened recently?**
### Current scope
Implement **Solana only**.
Do not add Ethereum, Bitcoin, Base, Arbitrum, Polygon, BNB Chain, Cosmos, XRP, Sui, Aptos, or any other blockchain in the current frontend.
The architecture should remain extensible for future blockchain families, but the current UI and data model must remain focused on Solana.
### Future capabilities
Future modules may include:
```text
Send
Swap
Trade
Stake
DeFi
Automation
Hardware Signers
Multisig
Additional Chains
```
Those capabilities must remain clearly separated from the current wallet/custody experience and must never be presented as implemented unless the backend actually supports them.
---
## 3. Core Product Principles
### 3.1 Wallet-first
Wallets are the primary object in the product.
The conceptual hierarchy is:
```text
Vault
  ↓
Wallets
  ↓
Assets
  ↓
Portfolio / Activity / Security / Intelligence
  ↓
Optional execution features
```
The interface must not allow trading to visually dominate the custody experience.
### 3.2 Security before convenience
Any feature involving:
- secrets
- signing
- broadcasting
- private-key export
- backup/restore
- destructive actions
- provider credential changes
must use deliberate confirmation and clear visual separation.
### 3.3 Data before decoration
Prioritize:
- readable information density
- useful tables
- clear hierarchy
- precise status indicators
- predictable controls
- fast access to primary objects
Decorative visual effects must never compete with useful information.
### 3.4 Real data only
Never fabricate:
- balances
- prices
- portfolio values
- performance history
- transactions
- activity
- alerts
- provider health
- RPC health
- market statistics
- risk findings
- wallet intelligence
- execution results
- transaction confirmations
Unavailable information must be shown as:
- Loading
- Empty
- Unavailable
- Unsupported
- Stale
- Failed
rather than being replaced with invented values.
### 3.5 Calm under failure
Rate limits, provider degradation, RPC failure, stale data, partial synchronization, and temporary network outages are normal operating conditions.
The interface should communicate them clearly without unnecessary panic, flashing effects, or alert overload.
### 3.6 Progressive disclosure
Show the most useful information first.
Put deeper technical information behind:
- expandable sections
- detail screens
- bottom sheets
- contextual menus
- diagnostic panels
Do not overwhelm the initial screen with every available field.
### 3.7 Consistency
Equivalent concepts must look and behave consistently throughout the application.
A wallet selector, status badge, asset row, alert, copy interaction, loading state, confirmation dialog, and error state should use the same interaction language everywhere.
---
## 4. System Architecture
The frontend follows a strict separation between presentation, state, visualization, and backend application services.
```text
                         SOLANA VAULT
                              │
                      React Native / Expo
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
       UI / UX          State / Data        Chart Engine
          │                   │                   │
      Tamagui             Zustand               Skia
      FlashList           TanStack Query        native-kline-view
      BottomSheet         WebSocket             D3
      Reanimated          Axios                 Optional LWC*
      Gesture Handler
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                       APPLICATION API
                              │
                   REST + WebSocket Events
                              │
                              ▼
                    Python / FastAPI Backend
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Vault/Wallet     Providers/RPC     Workers
          Core Services       & Health        / Sync
             │                │                │
             └────────────────┼────────────────┘
                              │
                         Solana Network
* Use a WebView chart only when it solves a real requirement.
```
### Long-term execution architecture
The supplied architecture blueprint also defines a future separation between market data, strategy, risk, and execution engines:
```text
Presentation Layer
        │
        ▼
Application API
        │
        ├── REST
        ├── WebSocket
        └── Event Streams
        │
        ▼
Trading / Application Engines
        │
        ├── Market Data
        ├── Strategy Engine
        ├── Risk Engine
        └── Execution Engine
        │
        ▼
Chain/DEX/Provider Integrations
```
This is an architectural direction, not a license to invent missing backend capabilities. The current frontend must expose only what `/Backend/` actually implements.
---
## 5. Performance Architecture
The frontend must be designed around smooth interaction and approximately 60fps rendering where practical.
### Rules
- Use React Native's New Architecture.
- Target Expo SDK 55+ as specified by the project architecture.
- Avoid legacy React Native styling patterns that create unnecessary work on the JS thread.
- Prefer native/UI-thread-friendly animations.
- Virtualize large lists.
- Avoid rendering thousands of rows simultaneously.
- Avoid unnecessary global rerenders when a single wallet, asset, or alert changes.
- Keep high-frequency data updates isolated from static UI.
- Use memoization selectively where it materially reduces work.
- Do not push high-frequency market updates through a monolithic global state object.
### Data update strategy
Use:
```text
Backend event
    ↓
WebSocket manager
    ↓
Validate event
    ↓
Identify affected resource
    ↓
Invalidate/update specific query
    ↓
Update minimal local UI state
    ↓
Render only affected components
```
Do not refresh the entire application after every event.
---
## 6. Approved Technology Stack
The project should use a **small, deliberate dependency set** rather than installing every available utility at once.
### 6.1 Presentation & Interface
Primary:
- React Native
- Expo
- TypeScript
- Expo Router
- Tamagui
- `@shopify/flash-list`
- `@gorhom/bottom-sheet`
- `react-native-safe-area-context`
- `react-native-screens`
- `react-native-gesture-handler`
- `react-native-reanimated`
- Lucide React Native
Additional interface utilities, when actually needed:
- React Hook Form
- Zod
- Zeego
- `@react-native-community/slider`
Do not introduce multiple overlapping UI frameworks.
### 6.2 State & Networking
Primary:
- Zustand
- TanStack Query
- Axios
- Native WebSocket
- Zod
Optional:
- RxJS for complex event-stream composition
- Socket.IO only for a backend that actually exposes Socket.IO
- Centrifuge client only if the backend actually exposes Centrifugo-compatible infrastructure
- `graphql-request` only for actual GraphQL endpoints
- SuperJSON only where serialization requirements justify it
- `axios-retry` only when retry behavior cannot be safely handled by the central client
Do not install a streaming library merely because it appears in the architecture matrix.
### 6.3 Solana
Primary:
- `@solana/kit`
- `@wallet-ui/react-native-kit`
- `@solana/mobile-wallet-adapter` when external wallet connections are actually required
- `@solana-program/system`
- `@solana-program/token`
- `@solana-program/associated-token-account`
- `@solana-program/compute-budget`
- `@solana-program/memo` when required
Compatibility:
- `@solana/web3.js` may be used when required by an existing dependency or integration.
Do not maintain two independent Solana transaction abstractions without a specific compatibility requirement.
### 6.4 Visualization
Primary:
- `@shopify/react-native-skia`
- `native-kline-view`
- D3 scale/shape utilities
Optional:
- TradingView Lightweight Charts when a WebView provides a clear advantage
- `react-native-wagmi-charts` only where its interaction model materially improves a use case
- Victory Native only where portfolio-oriented visualization cannot be adequately handled by the primary chart stack
Do not install multiple chart engines simply to provide stylistic alternatives.
### 6.5 Security & Cryptography
Approved when actually required:
- `react-native-keychain`
- `expo-secure-store`
- `react-native-biometrics`
- `expo-crypto`
- `react-native-securerandom`
- `tweetnacl`
- `@noble/curves`
- `@scure/bip39`
- `@scure/bip32`
- `react-native-ssl-pinning`
- `react-native-jailbreak-detector`
Security dependencies must be justified by the actual architecture and platform support.
### 6.6 Storage
- `react-native-mmkv` for non-sensitive preferences and safe high-speed local state
- `expo-sqlite` for structured local cache when needed
- `@tanstack/query-persist-client` only for safe, non-sensitive query data
- WatermelonDB only if the application demonstrates a real need for reactive large-scale local querying
### 6.7 Device/UX
- `expo-notifications`
- `expo-haptics`
- `expo-linking`
- `expo-device`
- `expo-file-system`
- `expo-application`
- audio tooling only when a real alert/fill sound requirement exists
### 6.8 Developer experience
- Jest
- React Native Testing Library
- Detox and/or Maestro
- Sentry or equivalent crash reporting only after sensitive-data filtering is guaranteed
- Day.js or Luxon if date complexity warrants a dedicated library
- `lodash-es`/Ramda only where utility complexity actually justifies them
---
## 7. Repository / Frontend Structure
The frontend is built inside the existing `/Frontend/` directory.
```text
Frontend/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── auth/
│   ├── home/
│   ├── wallets/
│   ├── portfolio/
│   ├── assets/
│   ├── activity/
│   ├── receive/
│   ├── trade/
│   ├── discover/
│   ├── screener/
│   ├── intelligence/
│   ├── risk/
│   ├── watchlists/
│   ├── strategies/
│   ├── alerts/
│   ├── search/
│   ├── health/
│   ├── security/
│   ├── backups/
│   ├── addresses/
│   ├── networks/
│   ├── accounting/
│   ├── settings/
│   └── advanced/
│
├── src/
│   ├── api/
│   ├── components/
│   ├── features/
│   │   ├── wallets/
│   │   ├── assets/
│   │   ├── portfolio/
│   │   ├── activity/
│   │   ├── trading/
│   │   ├── intelligence/
│   │   ├── risk/
│   │   ├── alerts/
│   │   └── providers/
│   ├── layouts/
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   ├── schemas/
│   ├── utils/
│   ├── constants/
│   ├── ws/
│   ├── security/
│   └── storage/
│
├── assets/
├── package.json
├── app.json / app.config.ts
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── .env.example
└── README.md
```
The design specification does not require every directory to be created before it is needed. Avoid empty placeholder architecture solely for the sake of a tree diagram.
---
## 8. Typography
Typography must favor clarity and dense financial information.
### Global type hierarchy
```text
Display       Dashboard totals
H1            Page title
H2            Major section
H3            Card/section heading
Body          Standard information
Label         Field/metadata label
Caption       Secondary information
Mono          Technical/numeric values
```
### Monospaced numeric system
All of the following should use a strictly monospaced font family such as **Roboto Mono** or an appropriate system monospace fallback:
- numeric portfolio values
- token balances
- prices
- price tickers
- percentage values
- transaction amounts
- fee values
- order/quote tables
- wallet addresses
- token mints
- transaction signatures
- hashes
- IDs
- block/slot values
- RPC diagnostics
- technical metrics
This prevents layout jitter during rapid value changes and makes columns visually stable.
The main interface may use a clean proportional sans-serif for labels and prose.
Avoid oversized typography. A large portfolio total may be prominent, but it should not consume most of the screen.
---
## 9. Color System
Use a restrained dark neutral foundation with semantic colors.
### Base palette
```text
Background        #0B0D10
Surface           #11151A
Elevated Surface  #171C22
Surface Hover     #1D232B
Border            #29313A
Border Strong     #39434E
Primary Text      #F3F6F8
Secondary Text    #A9B3BE
Muted Text        #737E89
```
### Accent
Use one restrained cool accent for primary actions and focus states.
A blue/indigo family is appropriate, but avoid neon saturation.
### Semantic states
```text
Success           #2DBE7F
Warning           #E5A93D
Danger            #E25555
Info              #5B9DFF
Stale             #8D7CC7
```
### Rules
- Green communicates healthy/positive status, not simply “money.”
- Red communicates danger/failure requiring attention.
- Yellow communicates warning/attention.
- Blue communicates neutral information or interaction.
- Purple/stale tones communicate cached/stale state where useful.
- Never use color alone to convey meaning.
---
## 10. Visual Language
### Desired qualities
- professional
- premium
- calm
- technical
- controlled
- dense but readable
- responsive
- precise
- trustworthy
### Avoid
- casino aesthetics
- meme-coin visual language
- neon overload
- excessive gradients
- excessive glassmorphism
- enormous rounded cards
- excessive pill-shaped controls
- decorative animation
- generic SaaS dashboard layouts
- excessive whitespace that forces unnecessary scrolling
- information hidden behind arbitrary visual containers
### Surfaces
Use cards/panels only when they create useful grouping.
Recommended radius:
```text
Small control       6–8
Card                10–12
Modal/sheet         14–16
Full-screen panel   16–20
```
Avoid turning every piece of information into a separate floating card.
---
## 11. Navigation Architecture
The application must expose all major sections.
```text
HOME
WALLETS
PORTFOLIO
ASSETS
ACTIVITY
RECEIVE
TRADE / SEND
DISCOVER
TOKEN SCREENER
WALLET INTELLIGENCE
DEV INTELLIGENCE
RISK MONITOR
WATCHLISTS
STRATEGIES
ALERTS
SEARCH
HEALTH
SECURITY
BACKUPS
ADDRESSES
NETWORKS / SERVICES
ACCOUNTING
SETTINGS
ADVANCED / FUTURE
```
### ALL TABS
An **ALL TABS** navigation surface must always exist.
The purpose is to ensure that a smaller screen never makes a page inaccessible.
### Navigation modes
Provide:
- expanded navigation
- compact navigation
- ALL TABS sheet
- command/search navigation
- deep linking
### Conceptual route model
```text
/home
/wallets
/wallets/:walletId
/wallets/:walletId/assets
/wallets/:walletId/activity
/assets/:assetId
/activity/:activityId
/receive
/alerts
/health
/security
/settings
```
Exact Expo Router paths may evolve, but the conceptual model should remain object-centric.
---
## 12. Canonical Wallet Context
Wallet context is one of the most important interaction patterns.
Users must be able to select:
```text
ALL WALLETS
```
or:
```text
INDIVIDUAL WALLET
```
The selected wallet affects:
- Home
- Portfolio
- Assets
- Activity
- Receive
- Alerts
- Risk
- Intelligence
- Search
- Accounting
- Trade/Send when supported
There must be one authoritative selected-wallet state.
Do not let each screen maintain a separate wallet selector state.
Wallet context should remain visible whenever it materially affects the current screen.
---
## 13. Home / Command Center
Home should answer:
> **What do I own, where is it, and is it healthy?**
### Conceptual layout
```text
┌───────────────────────────────────────────────────────────────┐
│ SOLANA VAULT           Wallet Selector          Alerts / Health│
├──────────────┬────────────────────────────────────────────────┤
│ Navigation   │ TOTAL PORTFOLIO                                │
│              │ $XX,XXX                                        │
│ Home         │ SOL    Tokens    Wallets    Alerts             │
│ Wallets      ├──────────────────────┬─────────────────────────┤
│ Portfolio    │ WALLET SUMMARY       │ RECENT ACTIVITY         │
│ Assets       │                      │                         │
│ Activity     │ Trading              │ Received                │
│ Receive      │ Savings              │ Token detected          │
│ ...          │ Treasury             │ Sync complete            │
│              │ Cold Storage         │ ...                     │
│              ├──────────────────────┴─────────────────────────┤
│              │ SECURITY / HEALTH / SYNC                       │
└──────────────┴────────────────────────────────────────────────┘
```
Home priorities:
1. Portfolio summary
2. Wallet summary
3. Security and alerts
4. Provider/RPC/sync health
5. Recent activity
6. Optional intelligence
Do not make a trading chart or buy/sell controls the dominant Home experience.
---
## 14. Wallet List & Wallet Profile
### Wallet list
Each wallet row should quickly communicate:
```text
NAME
ADDRESS
TYPE
GROUP
BALANCE
VALUE
STATUS
```
Use compact indicators for:
- watch-only
- cold storage
- signing disabled
- broadcasting disabled
- sync status
- health
### Wallet profile
Structure:
```text
Overview
Assets
Activity
Security
Notes
```
Actions may include when backend-supported:
- Receive
- Copy address
- Show QR
- Share
- Refresh/sync
- Edit metadata
- Verify integrity
Sensitive actions must be visually separated from ordinary navigation.
---
## 15. Wallet Creation & Import
Wallet creation should feel deliberate, explicit, and secure.
### Standard pattern
```text
CREATE / IMPORT WALLET
Wallet Type
[ Standard ] [ Watch-only ] [ Cold Storage ]
Name
...
Group
...
Tags
...
Permissions
Signing / Broadcast / Export
Security
☑ Store in encrypted vault
[ Continue ]
```
### Batch generation
Clearly communicate:
- number of wallets
- generated wallet type
- naming pattern
- group/tag assignment
- storage status
- resulting key/address integrity where verified
Never claim blockchain unlinkability or anonymity. The application may state that keypairs were generated independently where the backend establishes that fact, but that is not a guarantee of on-chain separation.
---
## 16. Asset Explorer
The asset explorer makes wallet contents understandable.
### Hierarchy
```text
WALLET
├── Native Assets
├── Tokens
│   ├── Token
│   ├── Token
│   └── Token
├── NFTs / Collectibles
└── Unknown / Quarantined
```
### Behaviors
- expand/collapse
- expand all
- collapse all
- search
- sort
- filter
- wallet filter
- asset-type filter
- hierarchical mode
- flat mode
- asset detail
- mobile detail bottom sheet
Use FlashList for large collections.
Unknown/unverified assets should be visually distinct without sensationalized language.
---
## 17. Asset Detail
Asset detail should answer:
> **What is this asset, why do I have it, and what does the system know about it?**
Suggested sections:
```text
Identity
Balance
Market Information
Metadata
Ownership
Token Account
Risk
Provider Sources
Activity
```
Render only fields supplied by the backend.
Technical fields may include:
- mint
- token account
- program
- decimals
- interface
- owner
- source
- last update
- authority information
Long addresses always receive:
- shortened display
- copy action
- accessible full-value view
- explorer link when supported
---
## 18. Portfolio
Portfolio is initially a read-oriented holdings experience.
Primary information:
- total value
- SOL
- token holdings
- wallet allocation
- asset allocation
- history
- snapshots
### Appropriate visualizations
- allocation bars/donuts
- portfolio value history
- wallet distribution
- asset distribution
- balance history
Avoid:
- flashing ticker walls
- giant candlestick charts on Home
- speculative P&L theatrics
- animations that make financial values hard to read
If historical data does not exist, show that historical data is unavailable.
---
## 19. Activity
Activity is an audit-like timeline rather than a speculative trading feed.
### Row anatomy
```text
[TYPE]   Received
         +2.5000 SOL
         Wallet 07
         4 min ago
         5xK...8mQ
         Confirmed
```
Filters:
- wallet
- asset
- type
- status
- direction
- date
- search
Use FlashList for large histories.
Transaction signatures should use monospaced typography and compact copy controls.
---
## 20. Receive
Receiving is a first-class feature.
### Primary layout
```text
RECEIVE
Wallet
[ Wallet 07 ▼ ]
NETWORK
SOLANA MAINNET
ADDRESS
9xK...83Pm
[ COPY ADDRESS ]
[ SHOW QR ]
[ SHARE ]
Optional Payment Request
Amount
Memo
[ GENERATE REQUEST ]
Recent Incoming Activity
```
QR generation should work locally when the required address/request information is already available.
Always emphasize:
> **Verify the wallet and network before sending funds to this address.**
---
## 21. Alerts & Notifications
Alerts should be visible without becoming intrusive.
### Header indicator
```text
Alerts  ● 3
```
### Alert center
Potential sections:
- Critical
- Warning
- Informational
- Suppressed
Filters:
- severity
- wallet
- asset
- state
- source
- date
Each alert should answer:
1. What happened?
2. Where did it happen?
3. How important is it?
4. What can the user do about it?
Never fabricate action buttons for unsupported backend operations.
---
## 22. Security Center
Security is a first-class navigation area.
### Structure
```text
VAULT
Encrypted / Locked / Unlocked
WALLETS
Integrity / Permissions
SIGNING
Enabled / Disabled
BROADCAST
Enabled / Disabled
PROVIDERS
Credential Health
NETWORK
RPC Health
EVENTS
Recent Security Events
```
Avoid a single opaque security score unless an actual backend calculation exists.
Prefer the concrete findings that explain the state.
---
## 23. Provider & RPC Design
Provider infrastructure should feel like operational tooling, not cluttered settings pages.
### Provider row
```text
HELIUS
Configured    HEALTHY
Latency       42 ms
Last success  18:43
Capabilities  RPC / DAS / Metadata
```
### RPC row
```text
RPC Endpoint
HEALTHY
42 ms
Rate limits normal
Preferred
```
When rate-limited:
```text
RATE LIMITED
Retrying in 2.4s
```
Never expose credentials in normal UI.
---
## 24. Backup Center
Backup operations are security-sensitive.
Clearly distinguish:
- Create backup
- Verify backup
- Export
- Import
- Restore
- History
For plaintext environment exports or sensitive wallet exports:
- show a prominent warning
- require explicit confirmation
- never log the contents
- never silently persist the exported secret material
The encrypted vault remains the conceptual protected source of truth.
---
## 25. Search & Command Interface
Global search should provide fast command-style navigation.
Potential result groups:
```text
WALLETS
ASSETS
TRANSACTIONS
ADDRESSES
ALERTS
WATCHLISTS
STRATEGIES
PROVIDERS
ACCOUNTING
```
Support:
- debouncing
- keyboard-friendly use where applicable
- bottom-sheet search on mobile
- deep navigation to result objects
- safely stored recent searches if implemented
Do not invent search intelligence that the backend does not provide.
---
## 26. Provider / Market Visualization
For screens that expose market information:
- use dense tables first
- use charts as contextual analysis
- keep axes and units explicit
- show source/freshness when supplied
- indicate cached/stale state
- never display a fabricated or unexplained price
Numeric market information should use the monospaced numeric system.
---
## 27. Future Trading / Execution Design
The application can eventually become a full professional trading terminal, but the current product must not disguise incomplete execution as finished.
### Long-term separation
```text
Wallet Core
    │
    ├── Holdings
    ├── Security
    ├── Receive
    └── Activity
          │
          ▼
      Future Send
          │
          ▼
      Future Swap
          │
          ▼
      Future Trading
```
### Future execution pipeline
```text
Order Entry
   ↓
Validation
   ↓
Quote / Pricing
   ↓
Simulation
   ↓
Risk Checks
   ↓
Explicit Confirmation
   ↓
Execution
   ↓
Transaction Tracking
   ↓
Confirmed / Failed
```
The UI must never imply that pressing a button equals execution.
### Trading terminal character
When supported, trading screens may use:- dense order/quote tables
- compact controls
- technical charting
- real-time status
- wallet/asset selectors
- fee/slippage controls
- execution state
- risk warnings
But trading must remain visually and architecturally distinct from the core vault experience.
---
## 28. Mobile Interaction Patterns
### Bottom Sheets
Use for:
- wallet selector
- asset selector
- filters
- quick actions
- transaction review
- confirmation
- details
### Gestures
Use gestures sparingly for:
- dismissing sheets
- secondary list actions
- navigation affordances
Never hide critical functionality behind obscure gestures.
### Haptics
Use subtle haptics for:
- successful copy
- important confirmation
- completed safe local operations
- confirmed transaction completion when the backend verifies it
Do not use aggressive vibration patterns.
### Native context menus
Use Zeego only for real contextual actions where native platform behavior improves usability.
---
## 29. Tables & Data Density
Data tables are a central UI pattern.
Rules:
- compact row heights
- strong column alignment
- monospaced numeric/technical values
- sortable headings where backend data supports sorting
- filters above the table
- horizontal scrolling where required
- sticky context where practical
- FlashList for large datasets
Do not force every field into the first visible row.
Use details/bottom sheets for secondary information.
### Order/quote tables
When execution capabilities exist, order/quote tables should prioritize:
- stable column widths
- monospaced numeric values
- fast updates
- compact row layout
- clear price/size/unit formatting
Do not animate every tick individually.
---
## 30. Loading States
Every network-backed screen must have deliberate loading states.
Preferred:
- skeleton rows
- muted placeholder blocks
- localized progress indicators
- explicit progress for background jobs
Avoid a full-screen spinner when only one panel is loading.
For background synchronization, show progress near the affected wallet/data instead of blocking the whole application.
---
## 31. Empty States
Empty states must explain why there is nothing to show.
Examples:
```text
NO WALLETS
Create or import your first wallet.
[ CREATE WALLET ]
```
```text
NO HISTORICAL DATA
Snapshots have not been captured yet.
```
```text
NO ALERTS
Nothing requires attention right now.
```
Do not use empty states as marketing copy.
---
## 32. Error States
Every error state should communicate:
- what failed
- whether data may be stale
- whether the issue may be temporary
- what the user can do next
Example:
```text
RPC CONNECTION DEGRADED
The selected RPC endpoint is currently rate-limited.
Cached wallet data is still available.
[ RETRY ] [ VIEW RPC HEALTH ]
```
Never expose raw exception traces to users.
---
## 33. Stale Data
Cached data must be recognizable as cached/stale without making the interface noisy.
Use:
- subtle stale badge
- last-updated timestamp
- “Last updated” metadata
- disabled live-only controls where necessary
Never silently present old information as live.
---
## 34. Responsive Design
The design is phone-first but should support tablets and larger screens.
### Phone
Use:
- compact navigation
- bottom sheets
- stacked sections
- horizontal scroll for genuinely wide tables
- progressive disclosure
### Tablet
Use:
- split views where useful
- persistent navigation
- larger tables
- side-by-side detail panels
### Large displays
Use:
- persistent navigation
- multi-column dashboards
- dense tables
- simultaneous context/detail views
### Universal requirement
Never clip:
- addresses
- balances
- buttons
- alerts
- status indicators
- important controls
Never remove access to an application section solely because the screen is small.
---
## 35. Accessibility
The application must provide:
- strong contrast
- visible focus states
- accessible labels
- semantic controls
- keyboard-friendly interaction where applicable
- accessible dialogs and bottom sheets
- adequate touch targets
- screen-reader-compatible names
- state communication that does not depend solely on color
Icons must have accessible labels where their meaning is not obvious.
---
## 36. Security & Secret Handling
The frontend must never persist sensitive material in ordinary storage.
Never store the following in:
- MMKV
- SQLite
- AsyncStorage
- TanStack Query persistence
- Zustand persisted state
- ordinary React state longer than strictly necessary
- logs
- analytics
- crash reports
Sensitive material includes:
- private keys
- seed phrases
- decrypted vault payloads
- provider/API credentials
- signing secrets
Where a credential genuinely must exist client-side, use platform-secure storage and minimize its lifetime and scope.
### Wallet state must be explicit
Clearly distinguish:
- Watch-only
- Cold storage
- Signing enabled
- Signing disabled
- Broadcasting enabled
- Broadcasting disabled
- Vault locked
- Vault unlocked
- Authenticated
- Session expired
---
## 37. API & Data Integrity UX
The central API client should handle:
- base URL
- timeouts
- JSON serialization
- HTTP errors
- authentication/session
- 400/401/403/404/409/429/500+
- request cancellation
- safe retries
- malformed responses
Only actual backend fields may be rendered.
Every major page must support:
- loading
- refreshing
- empty
- error
- unavailable
- stale
---
## 38. Realtime UX
The interface should support quiet, continuous realtime updates.
Header status may show:
```text
CONNECTED
RECONNECTING
DISCONNECTED
```
Additional subtle states may include:
- syncing
- stale
- rate limited
- provider degraded
- transaction pending
- execution confirmed
Avoid excessive animation and notification spam.
---
## 39. High-Frequency Data Rules
For future high-frequency market data or execution screens:
- isolate streaming state from static UI state
- use RxJS only for genuinely complex stream composition
- use virtualized lists
- avoid rebuilding full tables for single-tick updates
- use stable keys
- use memoized rows where appropriate
- keep animations on the UI thread
- do not use React state as a global high-frequency event bus
The goal is smooth rendering under rapid updates without compromising wallet/security clarity.
---
## 40. Performance Anti-Patterns
Do not:
- render thousands of ordinary `View` rows in one tree
- refetch the entire application after every websocket message
- put all backend state into one enormous Zustand store
- recreate expensive chart components for every tick
- use unbounded animation loops
- serialize sensitive data for persistence
- install duplicate libraries that solve the same problem
- create unnecessary WebViews
- create separate state models for the same resource
---
## 41. Backup / Export UX
Sensitive exports must have deliberate flows.
For wallet exports:
- group selection
- wallet selection
- field selection
- public/private data distinction
- warnings
- explicit confirmation
- export result state
Private-key export must remain opt-in and visually treated as sensitive plaintext when supported by the backend.
For `.env` export:
- clearly state that it contains plaintext secrets when applicable
- require confirmation
- do not log the content
- do not save silently to an application cache
---
## 42. Design of Diagnostics / Health
Diagnostics should be operational and understandable.
A health page can contain:
```text
BACKEND
HEALTHY
VAULT
LOCKED / UNLOCKED
RPC
HEALTHY / DEGRADED / RATE LIMITED
PROVIDERS
HEALTHY / UNCONFIGURED / ERROR
WEBSOCKET
CONNECTED / RECONNECTING / DISCONNECTED
SYNC WORKERS
RUNNING / IDLE / FAILED
```
Do not invent uptime scores or composite health numbers unless the backend provides them.
---
## 43. Provider Design
Provider interfaces should expose the minimum information needed for operations.
Current provider ecosystem may include:
- Helius
- GMGN
- DexScreener
- Birdeye
- Jupiter
- RugCheck
- Axiom
- Bitquery
Provider cards/rows may display:
- configured state
- enabled state
- health
- latency
- last successful request
- capabilities
- errors
- failover state
Never display credential values.
---
## 44. Solana-Specific Design
Solana is the only active blockchain scope.
The UI should understand first-class Solana concepts such as:
- SOL
- SPL tokens
- Token-2022
- token accounts
- mints
- wallet addresses
- transaction signatures
- slots
- RPC endpoints
- priority fees when backend-supported
- NFTs/collectibles when backend-supported
Do not expose chain-agnostic UI language where Solana-specific terminology improves clarity.
---
## 45. Future Multi-Chain Extensibility
The visual architecture should not block future chains.
However, do not add visible multi-chain controls until another chain is actually implemented.
Future architecture may eventually represent:
```text
Chain
  ↓
Wallet
  ↓
Asset
  ↓
Position
```
Current UI should behave as:
```text
Solana
  ↓
Wallet
  ↓
Asset
  ↓
Position
```
Do not introduce unused chain selectors just for future-proofing.
---
## 46. Testing & Quality
The frontend should have tests for:
- routing
- authentication state
- wallet context
- API error handling
- schema validation
- wallet lists
- asset explorer
- activity
- alerts
- provider status
- risk views
- send validation when implemented
- simulation state when implemented
- WebSocket reconnect behavior
- secret-storage protections
End-to-end smoke flow should eventually cover:
```text
Launch
 ↓
Connect to Backend
 ↓
Unlock/authenticate
 ↓
Home
 ↓
Select wallet
 ↓
View assets
 ↓
View activity
 ↓
Receive
 ↓
Alerts / Health
 ↓
Optional Send/Trade if actually implemented
 ↓
Return to Wallet Dashboard
 ↓
Lock
```
Execution tests must never risk real funds. Use simulation/test environments and explicit backend-safe execution boundaries.
---
## 47. Design Acceptance Criteria
A screen is considered complete only when:
- it matches this design language
- it uses actual backend data
- it has loading/empty/error behavior
- it works on smaller displays
- it does not clip important information
- large lists are virtualized where appropriate
- numeric data uses monospaced typography
- technical identifiers can be copied
- stale data is recognizable
- unsupported actions are clearly disabled/unavailable
- destructive/security-sensitive actions require confirmation
- no secrets leak into UI state or logs
- navigation remains accessible
---
## 48. Final Design Goal
The finished application should feel like a **premium professional self-custody wallet and digital-asset operations terminal**:
- precise
- calm
- secure
- information-dense
- fast
- readable
- technically credible
- responsive
- trustworthy
It should combine the **security and clarity of serious custody software** with the **density and responsiveness of professional trading infrastructure**, without allowing speculative trading aesthetics to overwhelm the wallet-first product.
The application should feel purpose-built, not template-generated.