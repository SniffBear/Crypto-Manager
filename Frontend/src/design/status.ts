/**
 * Status vocabulary.
 *
 * DESIGN.md §9: "Never use color alone to convey meaning." This module is
 * the single registry that maps every backend/domain status onto a
 * canonical label, a semantic tone and a glyph. `StatusBadge` renders it;
 * no screen invents its own status wording or colour.
 *
 * DESIGN.md §36 — wallet and vault state must always be explicit, so the
 * registry deliberately includes the security-relevant flags (watch-only,
 * cold storage, signing/broadcast permission) alongside connectivity and
 * health states.
 */

import type { Tone } from './tokens';

export type StatusGlyph =
  | 'dot'
  | 'lock'
  | 'unlock'
  | 'signal'
  | 'sync'
  | 'alert'
  | 'check'
  | 'cross'
  | 'slash'
  | 'clock'
  | 'flask';

export type StatusDefinition = {
  /** Canonical uppercase label shown to the user. */
  label: string;
  tone: Tone;
  glyph: StatusGlyph;
};

const S = (
  label: string,
  tone: Tone,
  glyph: StatusGlyph = 'dot',
): StatusDefinition => ({ label, tone, glyph });

/**
 * Registry keyed by normalised status token. Keys are lowercase so callers
 * can pass raw backend values directly.
 */
export const STATUS_REGISTRY: Record<string, StatusDefinition> = {
  /* Network */
  'solana mainnet': S('SOLANA MAINNET', 'accent'),
  mainnet: S('SOLANA MAINNET', 'accent'),
  'mainnet-beta': S('SOLANA MAINNET', 'accent'),

  /* Vault */
  'vault locked': S('VAULT LOCKED', 'warning', 'lock'),
  locked: S('VAULT LOCKED', 'warning', 'lock'),
  'vault unlocked': S('VAULT UNLOCKED', 'success', 'unlock'),
  unlocked: S('VAULT UNLOCKED', 'success', 'unlock'),
  encrypted: S('ENCRYPTED', 'info', 'lock'),

  /* Connection */
  connected: S('CONNECTED', 'success', 'signal'),
  reconnecting: S('RECONNECTING', 'warning', 'sync'),
  disconnected: S('DISCONNECTED', 'danger', 'alert'),
  offline: S('DISCONNECTED', 'danger', 'alert'),

  /* Operational */
  syncing: S('SYNCING', 'info', 'sync'),
  healthy: S('HEALTHY', 'success', 'check'),
  degraded: S('DEGRADED', 'warning', 'alert'),
  critical: S('CRITICAL', 'danger', 'alert'),
  'rate limited': S('RATE LIMITED', 'warning', 'alert'),
  'rate_limited': S('RATE LIMITED', 'warning', 'alert'),
  error: S('ERROR', 'danger', 'cross'),
  down: S('DOWN', 'danger', 'cross'),
  unknown: S('UNKNOWN', 'neutral'),

  /* Review state — an alert is read or it is not */
  unread: S('UNREAD', 'warning', 'dot'),
  read: S('READ', 'neutral', 'check'),

  /* Wallet security flags — DESIGN.md §36 */
  'watch only': S('WATCH ONLY', 'info', 'slash'),
  watch_only: S('WATCH ONLY', 'info', 'slash'),
  'cold storage': S('COLD STORAGE', 'stale', 'lock'),
  cold_storage: S('COLD STORAGE', 'stale', 'lock'),
  'signing enabled': S('SIGNING ENABLED', 'success', 'check'),
  'signing disabled': S('SIGNING DISABLED', 'neutral', 'slash'),
  'broadcast enabled': S('BROADCAST ENABLED', 'success', 'check'),
  'broadcast disabled': S('BROADCAST DISABLED', 'neutral', 'slash'),
  unconfigured: S('UNCONFIGURED', 'neutral', 'slash'),
  configured: S('CONFIGURED', 'success', 'check'),
  /** A boolean permission that is held. */
  granted: S('GRANTED', 'success', 'check'),
  /** A boolean permission that is withheld. */
  denied: S('DENIED', 'neutral', 'slash'),

  /* Transaction / execution */
  simulated: S('SIMULATED', 'stale', 'flask'),
  simulation: S('SIMULATED', 'stale', 'flask'),
  pending: S('PENDING', 'info', 'clock'),
  adapter_pending: S('ADAPTER PENDING', 'info', 'clock'),
  adapter_ready: S('ADAPTER READY', 'stale', 'flask'),
  confirmed: S('CONFIRMED', 'success', 'check'),
  failed: S('FAILED', 'danger', 'cross'),
  'transfer requested': S('TRANSFER REQUESTED', 'info', 'clock'),

  /* Chain synchronization and network capabilities */
  synced: S('SYNCED', 'success', 'check'),
  'not synced': S('NOT SYNCED', 'neutral', 'clock'),
  'not configured': S('NOT CONFIGURED', 'neutral', 'slash'),
  'not implemented': S('NOT IMPLEMENTED', 'neutral', 'slash'),
  implemented: S('IMPLEMENTED', 'success', 'check'),
  'read only partial': S('READ-ONLY', 'stale', 'flask'),
  'partial first page': S('PARTIAL HISTORY', 'stale', 'flask'),
  'partial provider page': S('PARTIAL HISTORY', 'stale', 'flask'),

  /* Capability */
  unsupported: S('UNSUPPORTED', 'neutral', 'slash'),
  unavailable: S('UNAVAILABLE', 'neutral', 'slash'),
  /** Backend supports part of a feature but not all of it. */
  partial: S('PARTIAL', 'stale', 'flask'),
  planned: S('PLANNED', 'stale', 'flask'),
  future: S('FUTURE', 'stale', 'flask'),
  ok: S('OK', 'success', 'check'),
};

/** Fallback so an unmapped backend value is shown honestly, not hidden. */
const UNKNOWN_STATUS: StatusDefinition = S('UNRECOGNISED', 'neutral', 'alert');

/** Normalise a raw status token into its canonical definition. */
export function statusFor(raw: string | null | undefined): StatusDefinition {
  if (!raw) return UNKNOWN_STATUS;
  const normalised = String(raw).trim().toLowerCase().replace(/_/g, ' ');
  const direct = STATUS_REGISTRY[normalised] ?? STATUS_REGISTRY[normalised.replace(/ /g, '_')];
  if (direct) return direct;
  // "RPC DEGRADED", "PROVIDER ERROR" and similar composed states.
  for (const [key, definition] of Object.entries(STATUS_REGISTRY)) {
    if (normalised.endsWith(key)) return definition;
  }
  return UNKNOWN_STATUS;
}

/* ───────────────  ALERT SEVERITY  ─────────────── */
export const ALERT_TONE: Record<string, Tone> = {
  critical: 'danger',
  error: 'danger',
  warning: 'warning',
  warn: 'warning',
  info: 'info',
  notice: 'info',
};

/* ───────────────  RISK LEVEL  ─────────────── */
export const RISK_TONE: Record<string, Tone> = {
  high: 'danger',
  critical: 'danger',
  medium: 'warning',
  moderate: 'warning',
  low: 'success',
  unknown: 'neutral',
};