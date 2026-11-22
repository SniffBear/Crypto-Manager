/**
 * Loading / empty / error states.
 *
 * DESIGN.md §30 (loading), §31 (empty), §32 (error), §47 (acceptance).
 * These four are the shared vocabulary every network-backed screen uses, so
 * a panel that is loading always looks the same and an empty result always
 * explains itself.
 *
 * Note the absence of a full-screen spinner: §30 explicitly asks for
 * localized progress, so these are panel-sized and embeddable.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AlertTriangle, Inbox, Lock, RefreshCw, WifiOff } from 'lucide-react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { Button, Row, Stack } from '@/components/primitives';
import { Text } from '@/components/primitives/Text';

/* ────────────────────────────  SKELETON  ──────────────────────────── */

/** Muted placeholder block (DESIGN.md §30). */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = radii.control,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.skeleton },
        style,
      ]}
    />
  );
}

/** A skeleton shaped like a list row — keeps layout stable while loading. */
export function SkeletonRow({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.skeletonRow} accessible={false}>
      <Skeleton width={40} height={40} radius={radii.control} />
      <View style={styles.skeletonRowBody}>
        <Skeleton width="55%" height={13} />
        {lines > 1 ? <Skeleton width="35%" height={11} /> : null}
      </View>
      <Skeleton width={64} height={13} />
    </View>
  );
}

export function SkeletonList({ count = 5, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ gap: spacing.sm }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} lines={lines} />
      ))}
    </View>
  );
}

/* ───────────────────────────  LOADING STATE  ─────────────────────────── */

/** Explicit, calm loading indicator for a single panel. */
export function LoadingState({
  label = 'Loading',
  detail,
  style,
}: {
  label?: string;
  detail?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.state, style]}
    >
      <RefreshCw size={20} color={colors.textMuted} />
      <Stack gap={spacing.xxs}>
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </Stack>
    </View>
  );
}

/* ────────────────────────────  EMPTY STATE  ──────────────────────────── */

/**
 * DESIGN.md §31 — an empty state must explain *why* there is nothing to
 * show. `hint` is required in spirit: avoid marketing copy.
 */
export function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
  icon = 'inbox',
  compact = false,
  style,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: 'inbox' | 'lock' | 'offline';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const IconComponent = icon === 'lock' ? Lock : icon === 'offline' ? WifiOff : Inbox;

  return (
    <View style={[styles.state, compact ? styles.stateCompact : null, style]}>
      <View style={styles.stateIcon}>
        <IconComponent size={compact ? 18 : 22} color={colors.textMuted} />
      </View>
      <Stack gap={spacing.xs} style={styles.stateText}>
        <Text variant="h3" align="center">
          {title}
        </Text>
        {hint ? (
          <Text variant="body" tone="muted" align="center">
            {hint}
          </Text>
        ) : null}
      </Stack>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  );
}

/* ────────────────────────────  ERROR STATE  ──────────────────────────── */

/**
 * DESIGN.md §32 — an error must say what failed, whether data may be stale,
 * whether it may be temporary, and what the user can do next. Raw exception
 * text is never rendered.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  /** True when previously loaded data is still on screen. */
  hasStaleData = false,
  retryable = true,
  onRetry,
  secondaryLabel,
  onSecondary,
  style,
}: {
  title?: string;
  message: string;
  hasStaleData?: boolean;
  retryable?: boolean;
  onRetry?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.state, style]}>
      <View style={[styles.stateIcon, styles.stateIconDanger]}>
        <AlertTriangle size={20} color={colors.danger} />
      </View>
      <Stack gap={spacing.sm} style={styles.stateText}>
        <Text variant="h3" align="center">
          {title}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {message}
        </Text>
        {hasStaleData ? (
          <Row gap={spacing.sm} justify="center">
            <Text variant="caption" tone="stale">
              Showing cached data — it may be out of date.
            </Text>
          </Row>
        ) : null}
      </Stack>
      {retryable && onRetry ? (
        <Row gap={spacing.md} justify="center">
          <Button label="Retry" variant="secondary" onPress={onRetry} />
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} variant="tertiary" onPress={onSecondary} />
          ) : null}
        </Row>
      ) : null}
    </View>
  );
}

/* ─────────────────────  UNSUPPORTED / NOT AVAILABLE  ───────────────────── */

/**
 * DESIGN.md §1 — when the backend does not implement something, the UI must
 * show an unavailable/unsupported/planned state rather than fabricating it.
 * This is the shared presentation for that condition.
 */
export function UnsupportedState({
  title,
  reason,
  detail,
  style,
}: {
  title: string;
  reason: string;
  detail?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.state, style]}>
      <View style={styles.stateIcon}>
        <Lock size={20} color={colors.stale} />
      </View>
      <Stack gap={spacing.sm} style={styles.stateText}>
        <Text variant="h3" align="center">
          {title}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {reason}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted" align="center">
            {detail}
          </Text>
        ) : null}
      </Stack>
    </View>
  );
}

/** Inline banner variant — for a capability notice inside a working page. */
export function NoticeBanner({
  tone = 'info',
  title,
  message,
  style,
}: {
  tone?: 'info' | 'warning' | 'stale' | 'neutral';
  title: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const toneColor =
    tone === 'warning'
      ? colors.warning
      : tone === 'stale'
        ? colors.stale
        : tone === 'neutral'
          ? colors.textMuted
          : colors.info;

  return (
    <View
      style={[
        styles.notice,
        { borderLeftColor: toneColor },
        style,
      ]}
    >
      <Stack gap={spacing.xs} style={{ flex: 1 }}>
        <Text variant="label" style={{ color: toneColor }}>
          {title}
        </Text>
        {message ? (
          <Text variant="caption" tone="secondary">
            {message}
          </Text>
        ) : null}
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xl,
  },
  stateCompact: {
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  stateIconDanger: {
    backgroundColor: colors.dangerMuted,
    borderColor: colors.danger,
  },
  stateText: {
    maxWidth: 420,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  skeletonRowBody: {
    flex: 1,
    gap: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
  },
});