/**
 * Backend unreachable.
 *
 * The vault lives behind an API this app does not control, so "the backend is
 * not answering" is a first-class state rather than a generic error. The
 * screen reports what was attempted, offers a retry, and never pretends any
 * data is available.
 *
 * Probe: GET /health (unversioned in the backend).
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, Row, Stack } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorState } from '@/components/feedback/states';
import { useServiceHealth } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth';
import { API_BASE_URL } from '@/api/client';
import { useConstrainedLayout } from '@/hooks/useResponsive';

const PROBE_INTERVAL_MS = 15_000;

export default function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const constrained = useConstrainedLayout();

  const bootstrap = useAuthStore((s) => s.bootstrap);
  const error = useAuthStore((s) => s.error);
  const health = useServiceHealth();

  // Probing the unversioned health endpoint is the cheapest way to know when
  // the backend is back; the session gate takes over as soon as it answers.
  useEffect(() => {
    const timer = setInterval(() => {
      void health.refetch();
    }, PROBE_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRetry = () => {
    void bootstrap();
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.huge },
      ]}
    >
      <View style={[styles.column, constrained ? styles.columnWide : null]}>
        <Stack gap={spacing.xxl}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <WifiOff size={22} color={colors.warning} />
            </View>
            <Text variant="overline" tone="warning">
              SOLANA VAULT
            </Text>
            <Text variant="h1">Backend unreachable</Text>
            <Text variant="body" tone="secondary">
              SOLANA VAULT stores its vault behind an API. No data can be read or written
              until that API answers.
            </Text>
          </View>

          <ErrorState
            title="No response from the API"
            message={
              error ??
              'The health probe did not complete. The vault may be locked, the API may be stopped, or the device may be offline.'
            }
            retryable={false}
            onRetry={onRetry}
          />

          <Card variant="elevated">
            <Stack gap={spacing.lg}>
              <Row justify="space-between" align="center" gap={spacing.lg}>
                <Text variant="overline" tone="muted">
                  Probe
                </Text>
                <StatusBadge
                  status={health.isError ? 'disconnected' : health.isFetching ? 'reconnecting' : 'unknown'}
                  size="sm"
                />
              </Row>
              <Divider />
              <Row justify="space-between" align="center" gap={spacing.lg}>
                <Text variant="caption" tone="muted">
                  Base URL
                </Text>
                <Text variant="monoSmall" tone="secondary" numberOfLines={1} style={styles.value}>
                  {API_BASE_URL}
                </Text>
              </Row>
              <Row justify="space-between" align="center" gap={spacing.lg}>
                <Text variant="caption" tone="muted">
                  Endpoint
                </Text>
                <Text variant="monoSmall" tone="secondary">
                  GET /health
                </Text>
              </Row>
              <Button label="Retry" variant="secondary" fullWidth onPress={onRetry} />
            </Stack>
          </Card>
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  column: { width: '100%', maxWidth: 520 },
  columnWide: { maxWidth: 600 },
  brand: { gap: spacing.md },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningMuted,
  },
  value: { flexShrink: 1, maxWidth: '60%', textAlign: 'right' },
});