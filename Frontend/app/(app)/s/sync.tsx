import { useMemo } from 'react';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { ErrorState, NoticeBanner } from '@/components/feedback/states';
import { useRunSync, useSyncStatus, errorMessage, isRetryable } from '@/hooks/useApi';

const KINDS = ['wallets', 'activity', 'prices', 'risk', 'metadata'] as const;

export default function SyncScreen() {
  const status = useSyncStatus();
  const run = useRunSync();

  usePageMeta({
    title: 'Sync center',
    subtitle: 'Read-only chain synchronization and provider-backed enrichment',
    breadcrumbs: [{ label: 'Menu' }, { label: 'Sync' }],
  });

  const rows = useMemo(
    () => KINDS.map((kind) => ({ kind, result: status.data?.[kind] })),
    [status.data],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Sync center"
          subtitle="Run one synchronization domain without refreshing the entire application."
        />

        <NoticeBanner
          tone="info"
          title="Real data only"
          message="Wallet/activity sync uses Solana RPC; metadata, prices and risk use configured providers. Unavailable dependencies remain explicitly unavailable."
        />

        {status.isError ? (
          <ErrorState
            title="Sync status unavailable"
            message={errorMessage(status.error)}
            retryable={isRetryable(status.error)}
            onRetry={() => void status.refetch()}
          />
        ) : null}

        <Stack gap={spacing.md}>
          {rows.map(({ kind, result }) => (
            <Card key={kind} variant="elevated">
              <Row justify="space-between" align="center" gap={spacing.lg} wrap>
                <Stack gap={spacing.xs} style={{ flex: 1 }}>
                  <Text variant="h3">{kind.toUpperCase()}</Text>
                  <Text variant="monoSmall" tone="muted" numberOfLines={4}>
                    {result ? JSON.stringify(result) : 'No run recorded yet'}
                  </Text>
                </Stack>
                <Button
                  label={run.isPending ? 'Running…' : 'Run now'}
                  variant="secondary"
                  loading={run.isPending}
                  disabled={run.isPending}
                  onPress={() => run.mutate(kind)}
                />
              </Row>
            </Card>
          ))}
        </Stack>

        {run.isSuccess ? (
          <Card variant="flat">
            <Text variant="caption" tone="secondary">
              Last run: {run.data.status}
            </Text>
          </Card>
        ) : null}

        {run.isError ? (
          <ErrorState
            title="Sync run failed"
            message={errorMessage(run.error)}
            retryable={isRetryable(run.error)}
            onRetry={() => run.reset()}
          />
        ) : null}
      </Stack>
    </PageContainer>
  );
}