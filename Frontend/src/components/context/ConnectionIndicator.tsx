/**
 * ConnectionIndicator — the single connection/operational status component.
 *
 * DESIGN.md §38 defines the header status vocabulary (CONNECTED /
 * RECONNECTING / DISCONNECTED, plus subtle syncing / stale / rate-limited /
 * provider-degraded states). Every screen reports through this component so
 * the icon, colour, typography, badge and spacing are identical everywhere.
 *
 * DESIGN.md §9 — state is never communicated by colour alone: the badge
 * always renders its label alongside the glyph.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/design/tokens';
import { StatusBadge } from '@/components/StatusBadge';
import { Row } from '@/components/primitives';
import { Text } from '@/components/primitives/Text';
import { useConnectionStore, type ConnectionState } from '@/stores/connection';
import { formatRelative } from '@/utils/format';

/** Fold the raw socket state plus operational flags into one label. */
export function resolveConnectionStatus(
  state: ConnectionState,
  syncing: boolean,
): { status: string; tone?: 'warning' | 'info' | 'stale' } {
  if (state === 'disconnected') return { status: 'disconnected' };
  if (state === 'reconnecting') return { status: 'reconnecting' };
  if (syncing) return { status: 'syncing', tone: 'info' };
  return { status: 'connected' };
}

export function ConnectionIndicator({
  compact = true,
  showLastEvent = false,
  style,
}: {
  /** `compact` is the App Bar treatment; the wide form adds context. */
  compact?: boolean;
  showLastEvent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const state = useConnectionStore((s) => s.state);
  const syncing = useConnectionStore((s) => s.syncing);
  const lastEventAt = useConnectionStore((s) => s.lastEventAt);

  const resolved = resolveConnectionStatus(state, syncing);

  if (!compact) {
    return (
      <View style={[{ gap: spacing.md }, style]}>
        <Row gap={spacing.md}>
          <StatusBadge status={resolved.status} tone={resolved.tone} />
          {showLastEvent && lastEventAt ? (
            <Text variant="caption" tone="muted">
              Last event {formatRelative(lastEventAt)}
            </Text>
          ) : null}
        </Row>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`Connection ${resolved.status}`}
      style={[styles.compact, style]}
    >
      <StatusBadge status={resolved.status} tone={resolved.tone} size="sm" />
    </View>
  );
}

/** Non-interactive connection state for tables/rows (no padding, no label wrap). */
export function ConnectionDot() {
  const state = useConnectionStore((s) => s.state);
  const syncing = useConnectionStore((s) => s.syncing);
  const resolved = resolveConnectionStatus(state, syncing);
  return <StatusBadge status={resolved.status} size="sm" />;
}

const styles = StyleSheet.create({
  compact: {
    minHeight: 24,
    justifyContent: 'center',
    // Fixed footprint so the App Bar never reflows when the state changes.
    minWidth: 96,
  },
});