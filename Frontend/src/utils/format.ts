/**
 * Display formatters.
 *
 * Every number, address and timestamp in the application is rendered
 * through one of these, so the numeric and technical presentation is
 * identical on every screen (DESIGN.md §8, §13, §19).
 *
 * All of these are pure and locale-stable; the monospaced face supplies the
 * column stability, so these only need to be consistent, not clever.
 */

const DASH = '—';

/* ─────────────────────────────  CURRENCY  ───────────────────────────── */

/** USD value. Uses grouping separators and a fixed 2dp for totals. */
export function formatUsd(value: number | null | undefined, options?: { decimals?: number }): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const decimals = options?.decimals ?? 2;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Compact form for dense allocation rows: $182.4K, $1.2M. */
export function formatUsdCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

/** Token amount. Precision follows the asset's own decimals where known. */
export function formatAmount(value: number | null | undefined, decimals = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatRatio(part: number, total: number): string {
  if (!total || !Number.isFinite(total)) return '—';
  return `${((part / total) * 100).toFixed(1)}%`;
}

/* ──────────────────────────────  SOLANA  ────────────────────────────── */

/** Lamports → SOL. 1 SOL = 1e9 lamports. */
export function formatLamports(lamports: number | null | undefined, decimals = 5): string {
  if (lamports === null || lamports === undefined || !Number.isFinite(lamports)) return DASH;
  return `${(lamports / 1_000_000_000).toFixed(decimals)} SOL`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return DASH;
  return `${Math.round(ms)} ms`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return DASH;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ────────────────────  IDENTIFIERS / ADDRESSES  ──────────────────── */

/**
 * Shorten a base58 address or signature for display while keeping both ends
 * recognisable. DESIGN.md §17: addresses always get a shortened display
 * plus a copy action and an accessible full-value view.
 */
export function shorten(value: string | null | undefined, lead = 4, tail = 4): string {
  if (!value) return DASH;
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export const shortenAddress = (address: string | null | undefined) => shorten(address, 4, 4);
export const shortenSignature = (signature: string | null | undefined) => shorten(signature, 6, 6);
export const shortenMint = (mint: string | null | undefined) => shorten(mint, 4, 6);

/* ─────────────────────────────  TIME  ───────────────────────────── */

/** `unlocked_at` is a unix timestamp in seconds; created_at is ISO. */
export function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    // Heuristic: 10-digit values are seconds, 13-digit are milliseconds.
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value: string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return DASH;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDate(value: string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return DASH;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatTime(value: string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return DASH;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "4 min ago" — relative recency for timelines (DESIGN.md §19). */
export function formatRelative(value: string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return DASH;
  const deltaMs = Date.now() - d.getTime();
  const future = deltaMs < 0;
  const seconds = Math.floor(Math.abs(deltaMs) / 1000);

  if (seconds < 45) return future ? 'in a moment' : 'just now';

  // Ordered largest-last; the first unit the elapsed time satisfies wins.
  const scales: { limit: number; divisor: number; unit: string }[] = [
    { limit: 60, divisor: 1, unit: 'sec' },
    { limit: 3600, divisor: 60, unit: 'min' },
    { limit: 86_400, divisor: 3600, unit: 'hr' },
    { limit: 604_800, divisor: 86_400, unit: 'day' },
  ];

  const match = scales.find((s) => seconds < s.limit) ?? {
    divisor: 604_800,
    unit: 'week',
  };
  const amount = Math.max(1, Math.floor(seconds / match.divisor));
  const plural = amount === 1 ? match.unit : `${match.unit}s`;
  return future ? `in ${amount} ${plural}` : `${amount} ${plural} ago`;
}

/* ────────────────────────────  LABELS  ──────────────────────────── */

/** Turn a snake_case / kebab-case backend token into a readable label. */
export function humanize(token: string | null | undefined): string {
  if (!token) return DASH;
  const cleaned = token.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return DASH;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/** Title Case for screen titles derived from route names. */
export function titleCase(token: string | null | undefined): string {
  if (!token) return DASH;
  return token
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export { DASH };