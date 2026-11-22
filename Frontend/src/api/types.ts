/**
 * Backend contract types.
 *
 * These mirror `Backend/backend/**` exactly, including snake_case field
 * names. There is deliberately no camelCase transformation layer: keeping
 * the wire shape means the frontend can never drift from the API, and a
 * field that does not exist here does not exist in the UI.
 *
 * Source of truth: Backend/backend/core/*.py and Backend/backend/api/*.py
 */

export type ISODateString = string;

/* ─────────────────────────────  VAULT  ───────────────────────────── */
export interface VaultMetadata {
  exists: boolean;
  locked: boolean;
  unlocked_at: number | null;
  path: string;
  format_version: number;
  kdf: string;
  iterations: number;
}

export interface AuthStatus {
  vault: VaultMetadata;
  authenticated_sessions: number;
  unlock_retry_after?: number;
}

export interface AuthResult {
  token: string;
  expires_at: ISODateString;
  vault: VaultMetadata;
}

/* ────────────────────────────  WALLETS  ──────────────────────────── */
export interface Wallet {
  id: string;
  address: string;
  label: string;
  group: string | null;
  role: string;
  watch_only: boolean;
  cold_storage: boolean;
  signing_enabled: boolean;
  broadcasting_enabled: boolean;
  secret_export_enabled: boolean;
  created_at: ISODateString;
  notes: string;
  tags: string[];
}

export interface WalletCreateRequest {
  label: string;
  group?: string | null;
  role?: 'standard' | 'watch_only' | 'cold';
  cold_storage?: boolean;
}

export interface WalletImportSecretRequest {
  secret_key: string;
  label: string;
  group?: string | null;
}

export interface WalletImportWatchOnlyRequest {
  address: string;
  label: string;
  group?: string | null;
}

/* ────────────────────────────  ASSETS  ──────────────────────────── */
export interface Asset {
  mint: string;
  symbol?: string;
  name?: string;
  value_usd?: number;
  wallet_ids?: string[];
  risk?: string;
  decimals?: number;
  program?: string;
  token_account?: string;
  price_usd?: number;
  updated_at?: ISODateString;
  metadata?: Record<string, unknown>;
  image_url?: string | null;
  holdings?: Record<string, Record<string, unknown>>;
}

/* ───────────────────────────  PORTFOLIO  ─────────────────────────── */
export interface PortfolioSummary {
  total_value_usd: number;
  asset_count: number;
  wallet_count: number;
  wallet_values_usd: Record<string, number>;
  unallocated_value_usd?: number;
}

export interface PortfolioSnapshot extends PortfolioSummary {
  timestamp: ISODateString;
}

export interface WalletSecretExport {
  wallet_id: string;
  secret_key_b58: string;
}

export interface SyncResult {
  status: string;
  updated_at?: ISODateString;
  [key: string]: unknown;
}

export interface BackupVerificationResult {
  name: string;
  valid: boolean;
  sha256?: string;
  detail?: string;
}

export interface BackupRestoreResult {
  restored: boolean;
  name: string;
  rollback_backup?: string;
  requires_unlock: boolean;
}

export interface ExecutionRecord {
  id: string;
  state: string;
  wallet_id: string;
  destination?: string | null;
  amount?: number | null;
  asset_mint?: string | null;
  simulation_id?: string | null;
  signature?: string | null;
  output_mint?: string | null;
  reason?: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
  broadcasted?: boolean;
  confirmed?: boolean;
  adapter_status?: string;
}

/* ───────────────────────────  ACTIVITY  ─────────────────────────── */
export interface ActivityRecord {
  id: string;
  type: string;
  status: string;
  wallet_id: string | null;
  destination?: string | null;
  amount?: number;
  asset_mint?: string | null;
  created_at: ISODateString;
  signature?: string | null;
  counterparty?: string | null;
  adapter_status?: string;
  broadcasted?: boolean;
  confirmed?: boolean;
  reason?: string;
  event_type?: string;
  description?: string | null;
  fee_lamports?: number | null;
  fee_sol?: number | null;
  counterparties?: string[];
  program_ids?: string[];
  instructions?: Record<string, unknown>[];
  native_changes?: Record<string, unknown>[];
  token_changes?: Record<string, unknown>[];
  native_transfers?: Record<string, unknown>[];
  token_transfers?: Record<string, unknown>[];
  account_data?: Record<string, unknown>[];
  compute_units_consumed?: number | null;
}

/* ────────────────────────────  RECEIVE  ──────────────────────────── */
export interface ReceiveInfo {
  wallet_id: string;
  address: string;
  label: string;
  watch_only: boolean;
}

/* ──────────────────────────  PROVIDERS  ────────────────────────── */
export interface ProviderSummary {
  name: string;
  configured: boolean;
  base_url: string | null;
  capabilities: string[];
}

export interface ProviderHealth {
  provider: string;
  status: string;
  configured: boolean;
  latency_ms?: number | null;
  http_status?: number;
  detail?: string;
}

/* ────────────────────────────  RPC  ──────────────────────────── */
export type RpcStatus =
  | 'OK'
  | 'DEGRADED'
  | 'RATE_LIMITED'
  | 'DOWN'
  | 'ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface RpcEndpoint {
  url: string;
  network: string;
  status: RpcStatus;
  latency_ms: number | null;
  failures: number;
  successes: number;
  last_checked_at: ISODateString | null;
  metadata: Record<string, unknown>;
}

export interface RpcCreateRequest {
  url: string;
  network: string;
  metadata?: Record<string, unknown>;
}

/* ────────────────────────────  ALERTS  ──────────────────────────── */
export type AlertLevel = 'critical' | 'warning' | 'info' | string;

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  wallet_id: string | null;
  kind: string;
  read: boolean;
  created_at: ISODateString;
}

export interface AlertRule {
  id: string;
  enabled: boolean;
  source: string;
  field: string;
  operator: string;
  threshold: number;
  wallet_id?: string | null;
  mint?: string | null;
  level: string;
  title: string;
  message: string;
  cooldown_seconds: number;
  last_triggered_at?: ISODateString | null;
}

/* ────────────────────────────  RISK  ──────────────────────────── */
export interface RiskOverview {
  asset_risk_buckets: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  asset_count: number;
}

/* ──────────────────────  WATCHLISTS / STRATEGIES  ────────────────────── */
export interface Watchlist {
  id: string;
  name: string;
  assets: string[];
}

export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  interval_seconds?: number;
  rules: Record<string, unknown>[];
  actions?: Record<string, unknown>[];
  last_run_at?: ISODateString | null;
  last_run_status?: string | null;
}

export interface StrategyRun {
  id: string;
  strategy_id: string;
  started_at: ISODateString;
  finished_at: ISODateString;
  matched: boolean;
  mode: string;
  status: string;
  actions: Record<string, unknown>[];
}

/* ──────────────────────────  ACCOUNTING  ────────────────────────── */
export interface AccountingEntry {
  id: string;
  type: string;
  description: string;
  amount_usd: number;
  wallet_id: string | null;
  asset_mint: string | null;
}

export interface AccountingCreateRequest {
  type: string;
  description: string;
  amount_usd?: number;
  wallet_id?: string | null;
  asset_mint?: string | null;
}

/* ───────────────────────────  BACKUPS  ─────────────────────────── */
export interface BackupFile {
  name: string;
  size: number;
  manifest?: {
    name: string;
    created_at: string;
    bytes: number;
    sha256: string;
    format_version: number;
    kdf: string;
  } | null;
}

export interface BackupCreateResult {
  path: string;
  created_at: string;
  manifest?: {
    name: string;
    created_at: string;
    bytes: number;
    sha256: string;
    format_version: number;
    kdf: string;
  };
}

export interface BackupVerificationResult {
  name: string;
  valid: boolean;
  sha256?: string;
  detail?: string;
}

/* ──────────────────────────  EXECUTION  ────────────────────────── */
export interface SimulationRequest {
  wallet_id: string;
  destination: string;
  amount: number;
  asset_mint?: string | null;
}

export interface SimulationResult {
  ok: boolean;
  simulation_id: string;
  wallet_id: string;
  destination: string;
  amount: number;
  asset_mint?: string | null;
  estimated_fee_lamports: number;
  status: 'SIMULATED';
}

export interface SwapSimulationResult {
  ok: boolean;
  status: string;
  adapter_status: string;
  message: string;
  executable: boolean;
}

/* ───────────────────────────  HEALTH  ─────────────────────────── */
export interface ServiceHealth {
  status: string;
  vault_exists: boolean;
  vault_locked: boolean;
}