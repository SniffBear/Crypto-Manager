/**
 * Central HTTP client.
 *
 * DESIGN.md §37 — one client owns base URL, timeouts, serialisation, HTTP
 * error mapping, bearer session handling, 400/401/403/404/409/429/500+,
 * cancellation and safe retries. Screens never call axios directly.
 *
 * DESIGN.md §36 — the session token is held in memory only. It is never
 * written to MMKV, SQLite, AsyncStorage, query persistence or logs.
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';

import type {
  AccountingCreateRequest,
  AccountingEntry,
  ActivityRecord,
  Alert,
  AlertRule,
  Asset,
  AuthResult,
  AuthStatus,
  BackupCreateResult,
  BackupFile,
  BackupRestoreResult,
  BackupVerificationResult,
  ExecutionRecord,
  PortfolioSnapshot,
  PortfolioSummary,
  ProviderSummary,
  ProviderHealth,
  ReceiveInfo,
  RiskOverview,
  RpcCreateRequest,
  RpcEndpoint,
  ServiceHealth,
  SimulationRequest,
  SimulationResult,
  Strategy,
  StrategyRun,
  SwapSimulationResult,
  SyncResult,
  VaultMetadata,
  Wallet,
  ChainNetwork,
  ChainAddressValidation,
  ChainSyncResult,
  WalletCreateRequest,
  WalletImportSecretRequest,
  WalletSecretExport,
  WalletImportWatchOnlyRequest,
  Watchlist,
} from './types';

const FALLBACK_BASE_URL = 'http://127.0.0.1:8000';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  if (extra?.apiUrl) return String(extra.apiUrl).replace(/\/$/, '');
  return FALLBACK_BASE_URL;
}

export const API_BASE_URL = resolveBaseUrl();
export const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly userMessage: string;
  readonly retryable: boolean;

  constructor(params: {
    status: number | null;
    code: string;
    userMessage: string;
    retryable: boolean;
  }) {
    super(params.userMessage);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.retryable = params.retryable;
  }

  get isVaultLocked(): boolean {
    return this.status === 423;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

let sessionToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

const client: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json', 'X-Nexus-Device-Name': 'Nexus Crypto Manager client' },
  // Non-2xx responses must reject so toApiError() and the global 401 handler run.
  validateStatus: (status) => status >= 200 && status < 300,
});

client.interceptors.request.use((config) => {
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return config;
});

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isCancel(error)) {
    return new ApiError({
      status: null,
      code: 'cancelled',
      userMessage: 'Request cancelled.',
      retryable: true,
    });
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError({
      status: null,
      code: 'unknown',
      userMessage: 'Something went wrong.',
      retryable: true,
    });
  }

  const axiosError = error as AxiosError<{ detail?: string }>;
  const status = axiosError.response?.status ?? null;
  const detail = axiosError.response?.data?.detail;

  if (!axiosError.response) {
    const unreachable =
      axiosError.code === 'ECONNABORTED'
        ? 'The request timed out.'
        : 'Cannot reach the backend.';
    return new ApiError({
      status: null,
      code: axiosError.code ?? 'network',
      userMessage: unreachable,
      retryable: true,
    });
  }

  switch (status) {
    case 400:
      return new ApiError({
        status,
        code: 'bad_request',
        userMessage: detail ?? 'The request was rejected.',
        retryable: false,
      });
    case 401:
      return new ApiError({
        status,
        code: 'unauthenticated',
        userMessage: detail ?? 'Authentication required.',
        retryable: false,
      });
    case 403:
      return new ApiError({
        status,
        code: 'forbidden',
        userMessage: detail ?? 'This action is not permitted.',
        retryable: false,
      });
    case 404:
      return new ApiError({
        status,
        code: 'not_found',
        userMessage: detail ?? 'Not found.',
        retryable: false,
      });
    case 409:
      return new ApiError({
        status,
        code: 'conflict',
        userMessage: detail ?? 'This conflicts with the current state.',
        retryable: false,
      });
    case 423:
      return new ApiError({
        status,
        code: 'vault_locked',
        userMessage: detail ?? 'The vault is locked.',
        retryable: false,
      });
    case 429:
      return new ApiError({
        status,
        code: 'rate_limited',
        userMessage: 'Rate limited. Wait before retrying.',
        retryable: true,
      });
    default:
      return new ApiError({
        status,
        code: 'server_error',
        userMessage: 'The backend reported an error.',
        retryable: true,
      });
  }
}

type RequestOptions = {
  signal?: AbortSignal;
  params?: Record<string, string | number | boolean | null | undefined>;
};

async function request<T>(
  config: AxiosRequestConfig,
  options: RequestOptions = {},
): Promise<T> {
  try {
    const response = await client.request<T>({
      ...config,
      params: options.params,
      signal: options.signal,
    });
    return response.data;
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.isUnauthenticated && onUnauthorized) onUnauthorized();
    throw apiError;
  }
}

const get = <T>(url: string, options?: RequestOptions) =>
  request<T>({ method: 'GET', url }, options);
const post = <T>(url: string, data?: unknown, options?: RequestOptions) =>
  request<T>({ method: 'POST', url, data }, options);
const put = <T>(url: string, data?: unknown, options?: RequestOptions) =>
  request<T>({ method: 'PUT', url, data }, options);
const del = <T>(url: string, options?: RequestOptions) =>
  request<T>({ method: 'DELETE', url }, options);

export const api = {
  health: (options?: RequestOptions) =>
    get<ServiceHealth>(`${API_BASE_URL}/health`, options),

  auth: {
    status: (options?: RequestOptions) => get<AuthStatus>('/auth/status', options),
    setup: (password: string) => post<AuthResult>('/auth/setup', { password }),
    unlock: (password: string) => post<AuthResult>('/auth/unlock', { password }),
    lock: () => post<{ locked: boolean }>('/auth/lock'),
  },

  vault: {
    info: (options?: RequestOptions) => get<VaultMetadata>('/vault', options),
    save: () => post<{ saved: boolean }>('/vault/save'),
  },

  wallets: {
    list: (options?: RequestOptions) => get<Wallet[]>('/wallets', options),
    get: (id: string, options?: RequestOptions) => get<Wallet>(`/wallets/${id}`, options),
    create: (body: WalletCreateRequest) => post<Wallet>('/wallets', body),
    importSecret: (body: WalletImportSecretRequest) =>
      post<Wallet>('/wallets/import/secret', body),
    importWatchOnly: (body: WalletImportWatchOnlyRequest) =>
      post<Wallet>('/wallets/import/watch-only', body),
    exportSecret: (walletId: string, password: string) =>
      post<WalletSecretExport>(`/wallets/${walletId}/export-secret`, { password }),
  },

  assets: {
    list: (
      params: { wallet_id?: string | null; search?: string | null } = {},
      options?: RequestOptions,
    ) => get<Asset[]>('/assets', { params, ...options }),
    get: (mint: string, options?: RequestOptions) =>
      get<Asset>(`/assets/${encodeURIComponent(mint)}`, options),
  },

  portfolio: {
    summary: (options?: RequestOptions) =>
      get<PortfolioSummary>('/portfolio/summary', options),
    history: (limit = 100, options?: RequestOptions) =>
      get<PortfolioSnapshot[]>('/portfolio/history', { params: { limit }, ...options }),
    snapshot: () => post<PortfolioSnapshot>('/portfolio/snapshots'),
  },

  activity: {
    list: (limit = 100, options?: RequestOptions) =>
      get<ActivityRecord[]>('/activity', { params: { limit }, ...options }),
  },

  receive: {
    info: (walletId: string, options?: RequestOptions) =>
      get<ReceiveInfo>(`/receive/${walletId}`, options),
  },

  providers: {
    list: (options?: RequestOptions) => get<ProviderSummary[]>('/providers', options),
    health: (options?: RequestOptions) => get<ProviderHealth[]>('/providers/health', options),
    configure: (name: string, body: { api_key?: string; base_url?: string }) =>
      put<{ name: string; configured: boolean }>(`/providers/${name}`, body),
  },

  rpc: {
    list: (options?: RequestOptions) => get<RpcEndpoint[]>('/rpc', options),
    add: (body: RpcCreateRequest) => post<RpcEndpoint>('/rpc', body),
    remove: (url: string) => del<{ removed: string }>('/rpc', { params: { url } }),
  },

  alerts: {
    list: (unreadOnly = false, options?: RequestOptions) =>
      get<Alert[]>('/alerts', { params: { unread_only: unreadOnly }, ...options }),
    create: (body: { level: string; title: string; message: string; wallet_id?: string | null; kind?: string }) =>
      post<Alert>('/alerts', body),
    markRead: (id: string) => post<{ read: boolean }>(`/alerts/${id}/read`),
    rules: (options?: RequestOptions) => get<AlertRule[]>('/alerts/rules', options),
    createRule: (body: Omit<AlertRule, 'id' | 'last_triggered_at'>) =>
      post<AlertRule>('/alerts/rules', body),
    deleteRule: (id: string) => del<{ deleted: boolean }>(`/alerts/rules/${id}`),
    evaluate: () => post<SyncResult>('/alerts/evaluate'),
  },

  research: {
    search: (q: string, options?: RequestOptions) =>
      get<Asset[]>('/research/search', { params: { q }, ...options }),
  },

  risk: {
    overview: (options?: RequestOptions) => get<RiskOverview>('/risk/overview', options),
  },

  watchlists: {
    list: (options?: RequestOptions) => get<Watchlist[]>('/watchlists', options),
    create: (body: { name: string; assets?: string[] }) => post<Watchlist>('/watchlists', body),
  },

  strategies: {
    list: (options?: RequestOptions) => get<Strategy[]>('/strategies', options),
    create: (body: {
      name: string;
      enabled?: boolean;
      interval_seconds?: number;
      rules?: Record<string, unknown>[];
      actions?: Record<string, unknown>[];
    }) => post<Strategy>('/strategies', body),
    run: (id: string) => post<StrategyRun>(`/strategies/${id}/run`),
    runs: (id: string, options?: RequestOptions) => get<StrategyRun[]>(`/strategies/${id}/runs`, options),
  },

  accounting: {
    list: (options?: RequestOptions) => get<AccountingEntry[]>('/accounting', options),
    create: (body: AccountingCreateRequest) => post<AccountingEntry>('/accounting', body),
  },

  backups: {
    list: (options?: RequestOptions) => get<BackupFile[]>('/backups', options),
    create: () => post<BackupCreateResult>('/backups/create'),
    verify: (name: string) =>
      post<BackupVerificationResult>('/backups/verify', undefined, { params: { name } }),
    restore: (name: string, password: string) =>
      post<BackupRestoreResult>('/backups/restore', { name, password, confirm: true }),
    rollback: (name: string, password: string) =>
      post<BackupRestoreResult>('/backups/rollback', undefined, {
        params: { name, password, confirm: true },
      }),
    remove: (name: string) =>
      del<{ deleted: string }>(`/backups/${encodeURIComponent(name)}`, {
        params: { confirm: true },
      }),
  },

  execution: {
    simulate: (body: SimulationRequest) => post<SimulationResult>('/execution/simulate', body),
    records: (options?: RequestOptions) =>
      get<ExecutionRecord[]>('/execution/records', options),
    transfer: (body: SimulationRequest & { confirm: boolean; confirm_new_recipient?: boolean; simulation_id?: string | null }) =>
      post<ExecutionRecord>('/execution/transfer', body),
    swapQuote: (body: {
      wallet_id: string;
      input_mint: string;
      output_mint: string;
      amount: number;
      slippage_bps?: number;
    }) => post<any>('/execution/swap/quote', body),
    swapBuild: (body: {
      wallet_id: string;
      input_mint: string;
      output_mint: string;
      amount: number;
      slippage_bps?: number;
    }) => post<ExecutionRecord>('/execution/swap/build', body),
    swapExecute: (body: {
      wallet_id: string;
      input_mint: string;
      output_mint: string;
      amount: number;
      slippage_bps?: number;
      confirm: boolean;
    }) => post<ExecutionRecord>('/execution/swap/execute', body),
    swapSimulate: (body: {
      wallet_id: string;
      input_mint: string;
      output_mint: string;
      amount: number;
      slippage_bps?: number;
    }) => post<SwapSimulationResult>('/execution/swap/simulate', body),
  },

  chains: {
    list: (options?: RequestOptions) => get<ChainNetwork[]>('/chains', options),
    get: (networkId: string, options?: RequestOptions) =>
      get<ChainNetwork & { provider: Record<string, unknown> }>(`/chains/${encodeURIComponent(networkId)}`, options),
    validateAddress: (networkId: string, address: string) =>
      post<ChainAddressValidation>(`/chains/validate-address?network_id=${encodeURIComponent(networkId)}`, { address }),
    provider: (networkId: string, options?: RequestOptions) =>
      get<Record<string, unknown>>(`/chains/${encodeURIComponent(networkId)}/provider`, options),
    configureProvider: (networkId: string, body: {
      base_url: string;
      api_key?: string;
      api_key_header?: string;
      username?: string;
      password?: string;
      wallet_address?: string;
    }) => put<Record<string, unknown>>(`/chains/${encodeURIComponent(networkId)}/provider`, body),
    health: (networkId: string, options?: RequestOptions) =>
      get<Record<string, unknown>>(`/chains/${encodeURIComponent(networkId)}/health`, options),
    syncWallet: (networkId: string, wallet_id: string) =>
      post<ChainSyncResult>(`/chains/${encodeURIComponent(networkId)}/sync`, { wallet_id }),
  },

  sync: {
    status: (options?: RequestOptions) =>
      get<Record<string, SyncResult>>('/sync/status', options),
    run: (kind: 'wallets' | 'activity' | 'prices' | 'risk' | 'metadata') =>
      post<SyncResult>('/sync/run', { kind }),
  },

  addressBook: {
    list: (network?: string, options?: RequestOptions) =>
      get<any[]>('/address-book', { ...options, params: { network } }),
    create: (body: { label: string; address: string; network: string; notes?: string; trusted?: boolean }) =>
      post<any>('/address-book', body),
    update: (id: string, body: { label?: string; notes?: string; trusted?: boolean }) =>
      request<any>({ method: 'PATCH', url: `/address-book/${id}`, data: body }),
    remove: (id: string) => del<{ deleted: boolean; id: string }>(`/address-book/${id}`),
    checkRecipient: (body: { address: string; network: string }) =>
      post<{ known: boolean; trusted: boolean; requires_confirmation: boolean; label?: string | null }>('/address-book/check-recipient', body),
    policy: (options?: RequestOptions) => get<{ require_new_recipient_confirmation: boolean }>('/address-book/settings/trusted-recipient-policy', options),
    setPolicy: (enabled: boolean) => put<{ require_new_recipient_confirmation: boolean }>('/address-book/settings/trusted-recipient-policy', { require_new_recipient_confirmation: enabled }),
  },

  reconciliation: {
    latest: (options?: RequestOptions) => get<any>('/portfolio/reconciliation', options),
    history: (limit = 100, options?: RequestOptions) => get<any[]>('/portfolio/reconciliation/history', { ...options, params: { limit } }),
    run: () => post<any>('/portfolio/reconciliation/run'),
  },

  featureSuite: {
    status: (options?: RequestOptions) => get<any>('/features/status', options),
    groups: (options?: RequestOptions) => get<any[]>('/features/wallet-groups', options),
    createGroup: (body: { name: string; description?: string; color?: string }) => post<any>('/features/wallet-groups', body),
    setGroupMembers: (id: string, wallet_ids: string[]) => put<any>(`/features/wallet-groups/${id}/members`, { wallet_ids }),
    deleteGroup: (id: string) => del<any>(`/features/wallet-groups/${id}`),
    policy: (options?: RequestOptions) => get<any>('/features/transaction-policy', options),
    setPolicy: (body: Record<string, unknown>) => put<any>('/features/transaction-policy', body),
    evaluateTransfer: (body: { network: string; destination: string; amount: string; fee?: string; wallet_id?: string }) => post<any>('/features/transactions/evaluate', body),
    schedules: (options?: RequestOptions) => get<any[]>('/features/scheduled-transfers', options),
    createSchedule: (body: Record<string, unknown>) => post<any>('/features/scheduled-transfers', body),
    cancelSchedule: (id: string) => post<any>(`/features/scheduled-transfers/${id}/cancel`, { confirm: true }),
    approveSchedule: (id: string) => post<any>(`/features/scheduled-transfers/${id}/approve`, { confirm: true }),
    batches: (options?: RequestOptions) => get<any[]>('/features/batches', options),
    createBatch: (body: { wallet_id: string; network: string; transfers: Record<string, unknown>[] }) => post<any>('/features/batches', body),
    costBasis: (options?: RequestOptions) => get<any>('/features/cost-basis', options),
    costBasisEntries: (options?: RequestOptions) => get<any[]>('/features/cost-basis/entries', options),
    portfolioAnalytics: (options?: RequestOptions) => get<any>('/features/portfolio-analytics', options),
    costBasisCsv: (options?: RequestOptions) => get<string>('/features/cost-basis/export.csv', options),
    addCostBasisEntry: (body: Record<string, unknown>) => post<any>('/features/cost-basis/entries', body),
    paymentRequests: (options?: RequestOptions) => get<any[]>('/features/payment-requests', options),
    createPaymentRequest: (body: Record<string, unknown>) => post<any>('/features/payment-requests', body),
    walletGraph: (options?: RequestOptions) => get<any>('/features/wallet-graph', options),
    askAssistant: (query: string) => post<any>('/features/assistant/query', { query }),
    fees: (network?: string, options?: RequestOptions) => get<any>('/features/fees', { ...options, params: { network } }),
    securityCenter: (options?: RequestOptions) => get<any>('/features/security-center', options),
    securityAlerts: (options?: RequestOptions) => get<any[]>('/features/security-alerts', options),
    acknowledgeSecurityAlert: (id: string) => post<any>(`/features/security-alerts/${id}/acknowledge`, { confirm: true }),
    recoveryChecklist: (options?: RequestOptions) => get<any>('/features/recovery-checklist', options),
    backupInventory: (verifyHashes = false, options?: RequestOptions) => get<any>('/features/backups/inventory', { ...options, params: { verify_hashes: verifyHashes } }),
    networkCapabilities: (options?: RequestOptions) => get<any[]>('/features/network-capabilities', options),
    exchangeHistory: (options?: RequestOptions) => get<any>('/features/exchange-history', options),
    transactionsCsv: (options?: RequestOptions) => get<string>('/features/transactions/export.csv', options),
    auditLog: (limit = 100, options?: RequestOptions) => get<any[]>('/features/audit-log', { ...options, params: { limit } }),
    metadataExport: (passphrase: string) => post<any>('/features/metadata-sync/export', { passphrase }),
    metadataImport: (bundle: string, passphrase: string, merge = true) => post<any>('/features/metadata-sync/import', { bundle, passphrase, merge }),
    devices: (options?: RequestOptions) => get<any>('/features/devices', options),
    revokeDevice: (id: string) => del<any>(`/features/devices/${id}`),
    backupPolicy: (options?: RequestOptions) => get<any>('/features/backup-policy', options),
    setBackupPolicy: (body: Record<string, unknown>) => put<any>('/features/backup-policy', body),
    limitOrders: (options?: RequestOptions) => get<any>('/features/limit-orders', options),
    createLimitOrder: (body: Record<string, unknown>) => post<any>('/features/limit-orders', body),
    cancelLimitOrder: (id: string) => post<any>(`/features/limit-orders/${id}/cancel`, { confirm: true }),
    explorer: (network: string, kind: string, identifier: string, options?: RequestOptions) => get<any>(`/features/explorer/${encodeURIComponent(network)}/${encodeURIComponent(kind)}/${encodeURIComponent(identifier)}`, options),
  },

  multisig: {
    list: (options?: RequestOptions) => get<any[]>('/multisig', options),
    create: (body: { name: string; members: string[]; threshold: number }) =>
      post<any>('/multisig', body),
    proposals: (options?: RequestOptions) => get<any[]>('/multisig/proposals', options),
    createProposal: (body: { multisig_id: string; wallet_id: string; transaction: Record<string, unknown> }) =>
      post<any>('/multisig/proposals', body),
    approve: (id: string, body: { member: string; signature_b58: string }) =>
      post<any>(`/multisig/proposals/${id}/approve`, body),
  },
};

export type Api = typeof api;