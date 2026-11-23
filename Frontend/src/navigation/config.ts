/**
 * SOLANA VAULT — NAVIGATION CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 * One definition of the information architecture. The App Bar breadcrumb,
 * the Bottom Navigation, the Global Menu, All Tabs and Search all derive
 * from this file, so a destination can never appear in one surface and be
 * missing from another.
 *
 * Canonical authenticated navigation (per the refactor contract):
 *     VAULT · WALLETS · ACTIVITY · MENU
 *
 * `availability` is derived strictly from the FastAPI backend. DESIGN.md §1
 * forbids inventing endpoints, so any destination the backend does not
 * implement is declared `unavailable` and rendered as an explicit
 * unavailable/planned state rather than fabricated functionality.
 */

/* ─────────────────────  BACKEND CAPABILITY MAP  ─────────────────────
 * Derived by reading Backend/backend/api/*.py. Keep in sync with backend.
 * ------------------------------------------------------------------ */
export type Availability = 'live' | 'partial' | 'unavailable';

export const BACKEND_CAPABILITIES = {
  auth: 'live',
  vault: 'live',
  wallets: 'live',
  walletCreate: 'live',
  walletImportSecret: 'live',
  walletImportWatchOnly: 'live',
  walletSecretExport: 'live',
  assets: 'live',
  tokenMetadata: 'live',

  assetDetail: 'live',
  portfolioSummary: 'live',
  portfolioSnapshots: 'live',
  /** PortfolioService exposes GET /portfolio/history. */
  portfolioHistory: 'live',
  activity: 'live',
  /** Activity has no server-side wallet filter; filtering is client-side. */
  activityFilterByWallet: 'partial',
  receive: 'live',
  alerts: 'live',
  risk: 'live',
  providers: 'live',
  providerHealth: 'live',
  rpc: 'live',
  researchSearch: 'live',
  watchlists: 'live',
  strategies: 'live',
  accounting: 'live',
  backups: 'live',
  backupRestore: 'live',
  executionSimulate: 'live',
  executionRecords: 'live',
  /** Execution simulation is implemented; live broadcast is globally disabled by default. */
  executionTransfer: 'partial',
  executionSwap: 'partial',
  /** Off-chain signature coordination only; no on-chain multisig program integration. */
  multisig: 'partial',
  /** Network-scoped contacts and trusted-recipient policy are persisted in the encrypted vault. */
  addressBook: 'live',
  /** Read-only reconciliation currently covers the configured Solana sync adapter only. */
  portfolioReconciliation: 'live',
  walletGroups: 'live',
  transactionPolicies: 'live',
  scheduledPaymentIntents: 'live',
  batchTransferDrafts: 'live',
  costBasisFifo: 'live',
  paymentRequests: 'partial',
  explorerLinks: 'partial',
  walletGraph: 'partial',
  localAssistant: 'live',
  encryptedMetadataSync: 'live',
  securityCenter: 'live',
  securityAlertReview: 'live',
  recoveryChecklist: 'live',
  backupIntegrityVerification: 'live',
  networkCapabilityMatrix: 'live',
  recordedExchangeHistory: 'partial',
  transactionCsvExport: 'live',
  feeQuoteCache: 'partial',
  alertOnlyLimitOrders: 'live',
  automaticEncryptedBackups: 'live',
  processLocalSessionManagement: 'partial',
  settings: 'unavailable',
  tokenScreener: 'unavailable',
  walletIntelligence: 'unavailable',
  developerIntelligence: 'unavailable',
  signatures: 'unavailable',
  syncControl: 'live',
  metadataSync: 'live',
  websocketEvents: 'live',
  health: 'live',
} as const satisfies Record<string, Availability>;

/* ───────────────────────────  ROUTE PATHS  ─────────────────────────── */
export const routes = {
  root: '/',
  setup: '/setup',
  unlock: '/unlock',
  offline: '/offline',

  vault: '/vault',
  vaultPortfolio: '/vault/portfolio',
  vaultSecurity: '/vault/security',
  vaultHealth: '/vault/health',

  wallets: '/wallets',
  walletsCreate: '/wallets/create',
  walletsImport: '/wallets/import',
  walletsGroups: '/wallets/groups',
  walletDetail: (id: string) => `/wallets/${id}`,
  walletAssets: (id: string) => `/wallets/${id}/assets`,
  walletActivity: (id: string) => `/wallets/${id}/activity`,
  walletSecurity: (id: string) => `/wallets/${id}/security`,

  activity: '/activity',
  activityDetail: (id: string) => `/activity/${id}`,

  menu: '/menu',

  allTabs: '/s',
  assets: '/s/assets',
  assetDetail: (mint: string) => `/s/assets/${mint}`,
  alerts: '/s/alerts',
  risk: '/s/risk',
  receive: '/s/receive',
  providers: '/s/providers',
  networks: '/s/networks',
  rpc: '/s/rpc',
  watchlists: '/s/watchlists',
  strategies: '/s/strategies',
  accounting: '/s/accounting',
  backups: '/s/backups',
  execution: '/s/execution',
  sync: '/s/sync',
  addressBook: '/s/address-book',
  reconciliation: '/s/reconciliation',
  featureSuite: '/s/feature-suite',
  multisig: '/s/multisig',
  search: '/s/search',
  discover: '/s/discover',
  advanced: '/s/advanced',
  unavailable: (feature: string) => `/s/${feature}`,
} as const;

/* ───────────────────────  PRIMARY DESTINATIONS  ─────────────────────── */
export type PrimaryKey = 'vault' | 'wallets' | 'activity' | 'menu';

export const PRIMARY_DESTINATIONS: {
  key: PrimaryKey;
  /** Uppercase per the canonical spec. */
  label: string;
  href: string;
  icon: string;
  description: string;
}[] = [
  {
    key: 'vault',
    label: 'Vault',
    href: routes.vault,
    icon: 'vault',
    description: 'Portfolio, security, sync and system health',
  },
  {
    key: 'wallets',
    label: 'Wallets',
    href: routes.wallets,
    icon: 'wallets',
    description: 'Wallet list, groups, detail and per-wallet security',
  },
  {
    key: 'activity',
    label: 'Activity',
    href: routes.activity,
    icon: 'activity',
    description: 'Transactions, incoming activity and signatures',
  },
  {
    key: 'menu',
    label: 'Menu',
    href: routes.menu,
    icon: 'menu',
    description: 'Every remaining section of the application',
  },
];

/* ────────────────────────────  GLOBAL MENU  ──────────────────────────── */
export type MenuItem = {
  label: string;
  href: string;
  icon: string;
  availability: Availability;
  detail?: string;
};

export type MenuSection = {
  title: string;
  items: MenuItem[];
};

export const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'Vault & Security',
    items: [
      { label: 'Security', href: routes.vaultSecurity, icon: 'shield', availability: 'live' },
      { label: 'Backups', href: routes.backups, icon: 'archive', availability: 'live' },
      { label: 'Execution', href: routes.execution, icon: 'send', availability: 'live' },
      { label: 'Multisig', href: routes.multisig, icon: 'users', availability: 'partial', detail: 'Off-chain proposal and signature coordination; not an on-chain multisig program' },
      {
        label: 'Addresses',
        href: routes.addressBook,
        icon: 'book',
        availability: 'live',
        detail: 'Network-scoped contacts, trusted recipients and new-recipient confirmation',
      },
      { label: 'Health', href: routes.vaultHealth, icon: 'activity', availability: 'live' },
    ],
  },
  {
    title: 'Assets & Research',
    items: [
      { label: 'Assets', href: routes.assets, icon: 'coins', availability: 'live' },
      { label: 'Discover', href: routes.discover, icon: 'compass', availability: 'live' },
      {
        label: 'Token Screener',
        href: routes.unavailable('token-screener'),
        icon: 'filter',
        availability: 'unavailable',
        detail: 'No screener endpoint is implemented by the backend',
      },
      {
        label: 'Wallet Intelligence',
        href: routes.unavailable('wallet-intelligence'),
        icon: 'search',
        availability: 'unavailable',
        detail: 'No wallet-intelligence endpoint is implemented by the backend',
      },
      {
        label: 'Developer Intelligence',
        href: routes.unavailable('developer-intelligence'),
        icon: 'terminal',
        availability: 'unavailable',
        detail: 'No developer-intelligence endpoint is implemented by the backend',
      },
      { label: 'Risk Monitor', href: routes.risk, icon: 'alert', availability: 'live' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Watchlists', href: routes.watchlists, icon: 'bookmark', availability: 'live' },
      { label: 'Strategies', href: routes.strategies, icon: 'target', availability: 'live' },
      { label: 'Alerts', href: routes.alerts, icon: 'bell', availability: 'live' },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'Networks & Providers', href: routes.providers, icon: 'plug', availability: 'live' },
      { label: 'Blockchains & Networks', href: routes.networks, icon: 'globe', availability: 'partial', detail: 'Chain registry, watch-only address imports and read-only network synchronization' },
      { label: 'RPC', href: routes.rpc, icon: 'server', availability: 'live' },
      { label: 'Portfolio Reconciliation', href: routes.reconciliation, icon: 'refresh-cw', availability: 'live', detail: 'Read-only balance and activity reconciliation for currently configured Solana wallets' },
      {
        label: 'Sync',
        href: routes.sync,
        icon: 'refresh',
        availability: 'live',
        detail: 'Read-only on-chain sync workers and authenticated manual sync controls are implemented',
      },
    ],
  },
  {
    title: 'Accounting',
    items: [{ label: 'Accounting', href: routes.accounting, icon: 'receipt', availability: 'live' }],
  },
  {
    title: 'System',
    items: [
      { label: 'Search', href: routes.search, icon: 'search', availability: 'live' },
      {
        label: 'Settings',
        href: routes.unavailable('settings'),
        icon: 'settings',
        availability: 'unavailable',
        detail: 'The backend exposes no settings or preferences route',
      },
      { label: 'Advanced / Future', href: routes.advanced, icon: 'flask', availability: 'live' },
      { label: 'Feature Suite', href: routes.featureSuite, icon: 'layers', availability: 'live', detail: 'Wallet groups, policy controls, scheduled intents, batch drafts, accounting intelligence and encrypted metadata sync' },
    ],
  },
];

/* ─────────────────────  VAULT / WALLETS / ACTIVITY  ─────────────────────
 * Each primary destination owns a set of sub-routes. These power the
 * "All Tabs" surface and the in-destination secondary navigation so that
 * every sub-page remains reachable (DESIGN.md §11, §34).
 * ------------------------------------------------------------------ */
export type SubDestination = {
  label: string;
  href: string;
  availability: Availability;
};

export const DESTINATION_CHILDREN: Record<PrimaryKey, SubDestination[]> = {
  vault: [
    { label: 'Home', href: routes.vault, availability: 'live' },
    { label: 'Portfolio', href: routes.vaultPortfolio, availability: 'live' },
    { label: 'Security', href: routes.vaultSecurity, availability: 'live' },
    { label: 'Health', href: routes.vaultHealth, availability: 'live' },
  ],
  wallets: [
    { label: 'Wallets', href: routes.wallets, availability: 'live' },
    { label: 'Create Wallet', href: routes.walletsCreate, availability: 'live' },
    { label: 'Import Wallet', href: routes.walletsImport, availability: 'live' },
    { label: 'Groups', href: routes.walletsGroups, availability: 'live' },
  ],
  activity: [
    { label: 'Activity', href: routes.activity, availability: 'live' },
    { label: 'Assets', href: routes.assets, availability: 'live' },
    { label: 'Receive', href: routes.receive, availability: 'live' },
  ],
  menu: [],
};

/* ───────────────────────────  HELPERS  ─────────────────────────── */

/** Resolve which primary destination owns a pathname. */
export function activePrimaryKey(pathname: string): PrimaryKey {
  if (pathname.startsWith('/wallets')) return 'wallets';
  if (pathname.startsWith('/activity')) return 'activity';
  if (pathname.startsWith('/menu')) return 'menu';
  return 'vault';
}

/** Flatten every destination for the All Tabs / search surfaces. */
export function allDestinations(): (MenuItem & { section: string })[] {
  const out: (MenuItem & { section: string })[] = [];
  for (const section of MENU_SECTIONS) {
    for (const item of section.items) out.push({ ...item, section: section.title });
  }
  return out;
}

/* ───────────────────  WALLET DETAIL SUB-ROUTES  ───────────────────
 * A wallet is one destination with four views. Defining the tab strip and its
 * routes once means the four route files cannot drift apart — which is how a
 * detail page ends up with a dead tab.
 * ------------------------------------------------------------------ */
export const WALLET_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'assets', label: 'Assets' },
  { key: 'activity', label: 'Activity' },
  { key: 'security', label: 'Security' },
] as const;

export type WalletDetailTab = (typeof WALLET_DETAIL_TABS)[number]['key'];

/** Route for one wallet-detail tab. Unknown keys fall back to the overview. */
export function walletDetailTabHref(walletId: string, tab: string): string {
  switch (tab) {
    case 'assets':
      return routes.walletAssets(walletId);
    case 'activity':
      return routes.walletActivity(walletId);
    case 'security':
      return routes.walletSecurity(walletId);
    default:
      return routes.walletDetail(walletId);
  }
}

/** Feature keys served by the single unavailable-state route. */
export const UNAVAILABLE_FEATURES: Record<
  string,
  { title: string; reason: string; backendNote: string }
> = {
  'token-screener': {
    title: 'Token Screener',
    reason: 'Token screener is not available',
    backendNote: 'No screening, filtering or ranking endpoint is implemented by the backend.',
  },
  'wallet-intelligence': {
    title: 'Wallet Intelligence',
    reason: 'Wallet intelligence is not available',
    backendNote: 'No wallet-investigation or counterparty endpoint is implemented by the backend.',
  },
  'developer-intelligence': {
    title: 'Developer Intelligence',
    reason: 'Developer intelligence is not available',
    backendNote: 'No developer or program-analysis endpoint is implemented by the backend.',
  },
  signatures: {
    title: 'Signatures',
    reason: 'Signature index is not available',
    backendNote:
      'Activity records are returned without a guaranteed signature field, so no signature index can be built without inventing data.',
  },
  settings: {
    title: 'Settings',
    reason: 'Settings are not available',
    backendNote:
      'The backend exposes no preferences, profile or configuration route. There is nothing for this application to read or persist, and no screen here would be storing a value anywhere.',
  },
  sync: {
    title: 'Sync',
    reason: 'Sync controls are available from the backend',
    backendNote:
      'Use the authenticated sync API to run wallet, activity, price or risk synchronization. The backend reports real provider/RPC status and does not fabricate successful runs.',
  },
};