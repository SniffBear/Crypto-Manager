/**
 * Query keys.
 *
 * Centralised so that a realtime event invalidates exactly the resources it
 * affects (DESIGN.md §5 — "Do not refresh the entire application after every
 * event") and two screens never accidentally duplicate a subscription.
 */

import type { AlertLevel } from './types';

export const queryKeys = {
  serviceHealth: ['service-health'] as const,

  authStatus: ['auth', 'status'] as const,
  vault: ['vault'] as const,

  wallets: ['wallets'] as const,
  wallet: (id: string) => ['wallets', id] as const,

  assets: (walletId: string | null, search: string | null) =>
    ['assets', { walletId: walletId ?? 'all', search: search ?? '' }] as const,
  asset: (mint: string) => ['assets', 'detail', mint] as const,

  portfolioSummary: ['portfolio', 'summary'] as const,
  portfolioHistory: ['portfolio', 'history'] as const,

  activity: (limit: number) => ['activity', { limit }] as const,

  receive: (walletId: string) => ['receive', walletId] as const,

  providers: ['providers'] as const,
  providerHealth: ['providers', 'health'] as const,

  rpc: ['rpc'] as const,

  alerts: (unreadOnly: boolean) => ['alerts', { unreadOnly }] as const,
  alertRules: ['alerts', 'rules'] as const,
  unreadAlertCount: ['alerts', 'count'] as const,

  risk: ['risk', 'overview'] as const,

  research: (q: string) => ['research', { q }] as const,

  watchlists: ['watchlists'] as const,
  strategies: ['strategies'] as const,
  strategyRuns: (id: string) => ['strategies', id, 'runs'] as const,
  accounting: ['accounting'] as const,
  backups: ['backups'] as const,
  executionRecords: ['execution', 'records'] as const,
  syncStatus: ['sync', 'status'] as const,
} as const;

/** Alert levels the backend can produce (see AlertService.create). */
export const ALERT_LEVELS: AlertLevel[] = ['critical', 'warning', 'info'];