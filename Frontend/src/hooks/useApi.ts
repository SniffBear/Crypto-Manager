/**
 * Typed data hooks.
 *
 * One hook per backend capability. Screens never call `api.*` directly, so
 * query keys, cache policy and error mapping stay in one place and a screen
 * cannot accidentally create a duplicate subscription (DESIGN.md §40).
 *
 * DESIGN.md §30 — loading is per-panel, not per-screen, so these hooks are
 * composed inside individual cards.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/api/client';
import { queryKeys } from '@/api/keys';
import type {
  ActivityRecord,
  Alert,
  AlertRule,
  Asset,
  AccountingEntry,
  BackupFile,
  PortfolioSummary,
  PortfolioSnapshot,
  ProviderHealth,
  ProviderSummary,
  StrategyRun,
  ExecutionRecord,
  ReceiveInfo,
  RiskOverview,
  RpcCreateRequest,
  RpcEndpoint,
  ServiceHealth,
  Strategy,
  Wallet,
  Watchlist,
} from '@/api/types';
import { useWalletContext } from '@/stores/wallet-context';

/** Shared failure text for a query error state (DESIGN.md §32). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.userMessage;
  return 'Something went wrong.';
}

export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError ? error.retryable : true;
}

/* ─────────────────────────────  SERVICE  ───────────────────────────── */

export function useServiceHealth() {
  return useQuery({
    queryKey: queryKeys.serviceHealth,
    queryFn: () => api.health(),
    // The unversioned health probe is how the app detects the backend at all.
    retry: 1,
    staleTime: 10_000,
  });
}

/* ────────────────────────────  WALLETS  ──────────────────────────── */

export function useWallets() {
  return useQuery({
    queryKey: queryKeys.wallets,
    queryFn: () => api.wallets.list(),
    staleTime: 15_000,
  });
}

export function useWallet(id: string | null) {
  return useQuery({
    queryKey: queryKeys.wallet(id ?? ''),
    queryFn: () => api.wallets.get(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useExportWalletSecret() {
  return useMutation({
    mutationFn: (input: { walletId: string; password: string }) =>
      api.wallets.exportSecret(input.walletId, input.password),
  });
}

/* ─────────────────────────────  ASSETS  ───────────────────────────── */

export function useAssets(options?: { walletId?: string | null; search?: string | null; enabled?: boolean }) {
  const walletId = options?.walletId;
  const search = options?.search ?? null;
  return useQuery({
    queryKey: queryKeys.assets(walletId ?? null, search),
    queryFn: () => api.assets.list({ wallet_id: walletId ?? null, search }),
    enabled: options?.enabled ?? true,
    staleTime: 20_000,
  });
}

export function useAsset(mint: string | null) {
  return useQuery({
    queryKey: queryKeys.asset(mint ?? ''),
    queryFn: () => api.assets.get(mint as string),
    enabled: Boolean(mint),
    staleTime: 30_000,
  });
}

/* ────────────────────────────  PORTFOLIO  ──────────────────────────── */

export function usePortfolioSummary() {
  return useQuery({
    queryKey: queryKeys.portfolioSummary,
    queryFn: () => api.portfolio.summary(),
    staleTime: 20_000,
  });
}

export function usePortfolioHistory(limit = 100) {
  return useQuery({
    queryKey: queryKeys.portfolioHistory,
    queryFn: () => api.portfolio.history(limit),
    staleTime: 30_000,
  });
}

/* ────────────────────────────  ACTIVITY  ──────────────────────────── */

export function useActivity(limit = 100) {
  return useQuery({
    queryKey: queryKeys.activity(limit),
    queryFn: () => api.activity.list(limit),
    staleTime: 10_000,
  });
}

/* ─────────────────────────────  RECEIVE  ───────────────────────────── */

export function useReceiveInfo(walletId: string | null) {
  return useQuery({
    queryKey: queryKeys.receive(walletId ?? ''),
    queryFn: () => api.receive.info(walletId as string),
    enabled: Boolean(walletId),
    staleTime: 60_000,
  });
}

/* ───────────────────────────  PROVIDERS  ─────────────────────────── */

export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => api.providers.list(),
    staleTime: 30_000,
  });
}

export function useProviderHealth() {
  return useQuery({
    queryKey: queryKeys.providerHealth,
    queryFn: () => api.providers.health(),
    staleTime: 15_000,
  });
}

export function useConfigureProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; api_key?: string; base_url?: string }) =>
      api.providers.configure(input.name, { api_key: input.api_key, base_url: input.base_url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.providers });
      queryClient.invalidateQueries({ queryKey: queryKeys.providerHealth });
    },
  });
}

/* ───────────────────────────────  RPC  ─────────────────────────────── */

export function useRpcEndpoints() {
  return useQuery({
    queryKey: queryKeys.rpc,
    queryFn: () => api.rpc.list(),
    staleTime: 15_000,
  });
}

export function useAddRpcEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RpcCreateRequest) => api.rpc.add(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rpc });
    },
  });
}

export function useRemoveRpcEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.rpc.remove(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rpc });
    },
  });
}

/* ──────────────────────────────  ALERTS  ────────────────────────────── */

export function useAlerts(unreadOnly = false) {
  return useQuery({
    queryKey: queryKeys.alerts(unreadOnly),
    queryFn: () => api.alerts.list(unreadOnly),
    staleTime: 10_000,
  });
}

/**
 * Unread count for the global AlertIndicator. Kept as a separate query from
 * the alert list so the indicator stays cheap and never re-renders a list.
 */
export function useUnreadAlertCount() {
  return useQuery({
    queryKey: queryKeys.unreadAlertCount,
    queryFn: () => api.alerts.list(true),
    select: (alerts: Alert[]) => alerts.length,
    staleTime: 10_000,
  });
}

export function useAlertRules() {
  return useQuery({
    queryKey: queryKeys.alertRules,
    queryFn: () => api.alerts.rules(),
    staleTime: 10_000,
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.alerts.createRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.alertRules }),
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.alerts.deleteRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.alertRules }),
  });
}

export function useEvaluateAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.alerts.evaluate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.alertRules });
    },
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.alerts.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

/* ───────────────────────────────  RISK  ─────────────────────────────── */

export function useRiskOverview() {
  return useQuery({
    queryKey: queryKeys.risk,
    queryFn: () => api.risk.overview(),
    staleTime: 30_000,
  });
}

/* ────────────────────────────  RESEARCH  ──────────────────────────── */

export function useResearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.research(trimmed),
    queryFn: () => api.research.search(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });
}

/* ─────────────────  WATCHLISTS / STRATEGIES / ACCOUNTING  ───────────────── */

export function useWatchlists() {
  return useQuery({
    queryKey: queryKeys.watchlists,
    queryFn: () => api.watchlists.list(),
    staleTime: 30_000,
  });
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; assets?: string[] }) => api.watchlists.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}

export function useStrategies() {
  return useQuery({
    queryKey: queryKeys.strategies,
    queryFn: () => api.strategies.list(),
    staleTime: 30_000,
  });
}

export function useStrategyRuns(id: string | null) {
  return useQuery({
    queryKey: queryKeys.strategyRuns(id ?? ''),
    queryFn: () => api.strategies.runs(id as string),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useRunStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.strategies.run,
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies });
      queryClient.invalidateQueries({ queryKey: queryKeys.strategyRuns(id) });
    },
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    // `rules` is passed through verbatim. The backend declares it as an opaque
    // list of objects with no schema and no validator, so nothing here may
    // invent one.
    mutationFn: (body: {
      name: string;
      enabled?: boolean;
      interval_seconds?: number;
      rules?: Record<string, unknown>[];
      actions?: Record<string, unknown>[];
    }) => api.strategies.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.strategies }),
  });
}

export function useAccounting() {
  return useQuery({
    queryKey: queryKeys.accounting,
    queryFn: () => api.accounting.list(),
    staleTime: 30_000,
  });
}

export function useCreateAccountingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.accounting.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting }),
  });
}

/* ─────────────────────────────  BACKUPS  ───────────────────────────── */

export function useBackups() {
  return useQuery({
    queryKey: queryKeys.backups,
    queryFn: () => api.backups.list(),
    staleTime: 60_000,
  });
}

export function useVerifyBackup() {
  return useMutation({
    mutationFn: api.backups.verify,
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; password: string }) =>
      api.backups.restore(input.name, input.password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.backups }),
  });
}

export function useRollbackBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; password: string }) =>
      api.backups.rollback(input.name, input.password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.backups }),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.backups.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.backups }),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.backups.create(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.backups }),
  });
}

export function useExecutionRecords() {
  return useQuery({
    queryKey: queryKeys.executionRecords,
    queryFn: () => api.execution.records(),
    staleTime: 5_000,
  });
}

export function useSimulateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.execution.simulate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.executionRecords }),
  });
}

export function useExecuteTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.execution.transfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executionRecords });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(100) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
    },
  });
}

export function useSwapQuote() {
  return useMutation({ mutationFn: api.execution.swapQuote });
}

export function useSwapSimulate() {
  return useMutation({ mutationFn: api.execution.swapSimulate });
}

export function useSwapBuild() {
  return useMutation({ mutationFn: api.execution.swapBuild });
}

export function useSwapExecute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.execution.swapExecute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executionRecords });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(100) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
    },
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: queryKeys.syncStatus,
    queryFn: () => api.sync.status(),
    staleTime: 5_000,
  });
}

export function useMultisigWallets() {
  return useQuery({
    queryKey: ['multisig'],
    queryFn: () => api.multisig.list(),
    staleTime: 15_000,
  });
}

export function useMultisigProposals() {
  return useQuery({
    queryKey: ['multisig', 'proposals'],
    queryFn: () => api.multisig.proposals(),
    staleTime: 10_000,
  });
}

export function useCreateMultisig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.multisig.create,
    onSuccess: () => client.invalidateQueries({ queryKey: ['multisig'] }),
  });
}

export function useApproveMultisigProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; member: string; signature_b58: string }) =>
      api.multisig.approve(input.id, {
        member: input.member,
        signature_b58: input.signature_b58,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['multisig', 'proposals'] }),
  });
}

export function useRunSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.sync.run,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.syncStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      queryClient.invalidateQueries({ queryKey: queryKeys.assets(null, null) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(100) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
    },
  });
}

/* ──────────────────────  WALLET-AWARE CONVENIENCE  ────────────────────── */

/**
 * Assets filtered by the canonical wallet context (DESIGN.md §12). When the
 * context is ALL WALLETS the backend is asked for the unfiltered set.
 */
export function useScopedAssets(search: string | null = null) {
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  return useAssets({ walletId: selectedWalletId, search });
}

/** The full activity list plus a client-side filter for the wallet context.
 *  The backend exposes no wallet filter, so this is applied in the
 *  presentation layer rather than by inventing a query parameter. */
export function useScopedActivity(limit = 100) {
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const query = useActivity(limit);
  const records = selectedWalletId
    ? (query.data ?? []).filter((r) => r.wallet_id === selectedWalletId)
    : (query.data ?? []);
  return { ...query, data: records };
}

/* ────────────────────────────  COMMAND SEARCH  ────────────────────────────
 * DESIGN.md §25 asks for one command-style search over wallets, assets,
 * transactions, alerts, watchlists, strategies, providers and accounting.
 *
 * Two deliberate constraints:
 *
 *  1. Every query reuses the *existing* query keys, so a token found here is
 *     the same cache entry the asset index, the alert centre and the menu
 *     already read. Search adds no parallel cache to keep in step.
 *  2. Nothing is fetched until something has been typed. A search screen that
 *     pulls eight collections on mount is slower than the navigation it is
 *     meant to accelerate.
 *
 * Matching is a plain case-insensitive substring over the fields the backend
 * actually returns. The backend exposes no search index, ranking or fuzzy
 * matching, so none is simulated here.
 *
 * Addresses are absent because the backend has no address book to search.
 * ------------------------------------------------------------------- */

export type CommandMatches = {
  wallets: Wallet[];
  assets: Asset[];
  transactions: ActivityRecord[];
  alerts: Alert[];
  watchlists: Watchlist[];
  strategies: Strategy[];
  providers: ProviderSummary[];
  accounting: AccountingEntry[];
};

export const COMMAND_GROUPS: (keyof CommandMatches)[] = [
  'wallets',
  'assets',
  'transactions',
  'alerts',
  'watchlists',
  'strategies',
  'providers',
  'accounting',
];

const contains = (term: string, ...values: (string | null | undefined)[]): boolean =>
  values.some((value) => typeof value === 'string' && value.toLowerCase().includes(term));

/** Per-group cap so one large collection cannot crowd out the others. */
export const COMMAND_GROUP_LIMIT = 6;

export function useCommandSearch(query: string) {
  const term = query.trim().toLowerCase();
  const active = term.length > 0;

  const wallets = useQuery({
    queryKey: queryKeys.wallets,
    queryFn: () => api.wallets.list(),
    enabled: active,
    staleTime: 15_000,
  });
  const assets = useQuery({
    queryKey: queryKeys.assets(null, null),
    queryFn: () => api.assets.list({ wallet_id: null, search: null }),
    enabled: active,
    staleTime: 20_000,
  });
  const activity = useQuery({
    queryKey: queryKeys.activity(100),
    queryFn: () => api.activity.list(100),
    enabled: active,
    staleTime: 10_000,
  });
  const alerts = useQuery({
    queryKey: queryKeys.alerts(false),
    queryFn: () => api.alerts.list(false),
    enabled: active,
    staleTime: 10_000,
  });
  const watchlists = useQuery({
    queryKey: queryKeys.watchlists,
    queryFn: () => api.watchlists.list(),
    enabled: active,
    staleTime: 30_000,
  });
  const strategies = useQuery({
    queryKey: queryKeys.strategies,
    queryFn: () => api.strategies.list(),
    enabled: active,
    staleTime: 30_000,
  });
  const providers = useQuery({
    queryKey: queryKeys.providers,
    queryFn: () => api.providers.list(),
    enabled: active,
    staleTime: 30_000,
  });
  const accounting = useQuery({
    queryKey: queryKeys.accounting,
    queryFn: () => api.accounting.list(),
    enabled: active,
    staleTime: 30_000,
  });

  const queries = [wallets, assets, activity, alerts, watchlists, strategies, providers, accounting];

  const isLoading = active && queries.some((q) => q.isLoading);
  const isFetching = active && queries.some((q) => q.isFetching);
  const failedGroups = queries
    .map((q, index) => (q.isError ? COMMAND_GROUPS[index] : null))
    .filter((key): key is keyof CommandMatches => key !== null);

  const matches = useMemo<CommandMatches>(() => {
    const limit = COMMAND_GROUP_LIMIT;
    return {
      wallets: (wallets.data ?? [])
        .filter((w) => contains(term, w.label, w.address, w.group, w.role, w.notes))
        .slice(0, limit),
      assets: (assets.data ?? [])
        .filter((a) => contains(term, a.symbol, a.name, a.mint, a.program, a.token_account))
        .slice(0, limit),
      transactions: (activity.data ?? [])
        .filter((r) => contains(term, r.id, r.type, r.status, r.destination, r.asset_mint, r.signature))
        .slice(0, limit),
      alerts: (alerts.data ?? [])
        .filter((a) => contains(term, a.title, a.message, a.kind, a.level, a.wallet_id))
        .slice(0, limit),
      watchlists: (watchlists.data ?? [])
        .filter((w) => contains(term, w.name, ...w.assets))
        .slice(0, limit),
      strategies: (strategies.data ?? [])
        .filter((s) => contains(term, s.name, JSON.stringify(s.rules)))
        .slice(0, limit),
      providers: (providers.data ?? [])
        .filter((p) => contains(term, p.name, p.base_url, ...p.capabilities))
        .slice(0, limit),
      accounting: (accounting.data ?? [])
        .filter((e) => contains(term, e.description, e.type, e.asset_mint, e.wallet_id))
        .slice(0, limit),
    };
  }, [
    term,
    wallets.data,
    assets.data,
    activity.data,
    alerts.data,
    watchlists.data,
    strategies.data,
    providers.data,
    accounting.data,
  ]);

  const total = COMMAND_GROUPS.reduce((sum, key) => sum + matches[key].length, 0);

  return {
    term,
    active,
    matches,
    total,
    isLoading,
    isFetching,
    failedGroups,
    refetch: () => {
      for (const q of queries) void q.refetch();
    },
  };
}

/* ──────────────────────────  TYPE RE-EXPORTS  ────────────────────────── */

export type {
  ActivityRecord,
  Alert,
  Asset,
  AccountingEntry,
  BackupFile,
  PortfolioSummary,
  ProviderSummary,
  ReceiveInfo,
  RiskOverview,
  RpcEndpoint,
  ServiceHealth,
  Strategy,
  Wallet,
  Watchlist,
};