/**
 * VAULT / HEALTH — is the thing actually working?
 *
 * Three real signals, in the order an operator cares about them:
 *   1. the service itself  (GET /health, unversioned in the backend)
 *   2. the RPC mesh         (GET /rpc — status, latency, success/failure counts)
 *   3. the providers        (GET /providers — which integrations are configured)
 *
 * Nothing here is inferred. If the backend does not report a field, the cell
 * renders a dash rather than a guess.
 *
 * Data: GET /health, /rpc, /providers
 */

import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorState, SkeletonList } from '@/components/feedback/states';
import { ConnectionIndicator } from '@/components/context/ConnectionIndicator';
import {
  errorMessage,
  isRetryable,
  useProviders,
  useRpcEndpoints,
  useServiceHealth,
  type RpcEndpoint,
} from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatDateTime, formatLatency, formatNumber, formatRelative } from '@/utils/format';

const RPC_COLUMNS = {
  url: 208,
  network: 116,
  status: 118,
  latency: 96,
  failures: 96,
  checked: 132,
} as const;

export default function VaultHealthScreen() {
  const router = useRouter();

  usePageMeta({
    title: 'Health',
    subtitle: 'Service, RPC mesh and provider status',
    breadcrumbs: [{ label: 'Vault' }, { label: 'Health' }],
  });

  const health = useServiceHealth();
  const rpc = useRpcEndpoints();
  const providers = useProviders();

  const refreshAll = useCallback(() => {
    void health.refetch();
    void rpc.refetch();
    void providers.refetch();
  }, [health, rpc, providers]);

  const endpoints = rpc.data ?? [];
  const degraded = endpoints.filter(
    (e) => e.status !== 'OK' && e.status !== 'UNKNOWN',
  ).length;

  const rpcColumns: Column<RpcEndpoint>[] = [
    {
      key: 'url',
      header: 'Endpoint',
      width: RPC_COLUMNS.url,
      mono: true,
      render: (row) => (
        <Text variant="monoSmall" numberOfLines={1}>
          {row.url}
        </Text>
      ),
    },
    {
      key: 'network',
      header: 'Network',
      width: RPC_COLUMNS.network,
      render: (row) => <StatusBadge status={row.network} size="sm" />,
    },
    {
      key: 'status',
      header: 'Status',
      width: RPC_COLUMNS.status,
      sortable: true,
      sortValue: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'latency',
      header: 'Latency',
      width: RPC_COLUMNS.latency,
      align: 'right',
      mono: true,
      sortable: true,
      sortValue: (row) => row.latency_ms ?? Number.MAX_SAFE_INTEGER,
      render: (row) => (
        <Text variant="monoSmall" tone="secondary" align="right">
          {formatLatency(row.latency_ms)}
        </Text>
      ),
    },
    {
      key: 'failures',
      header: 'Fail / OK',
      width: RPC_COLUMNS.failures,
      align: 'right',
      mono: true,
      render: (row) => (
        <Text variant="monoSmall" tone={row.failures > 0 ? 'danger' : 'muted'} align="right">
          {formatNumber(row.failures)} / {formatNumber(row.successes)}
        </Text>
      ),
    },
    {
      key: 'checked',
      header: 'Last checked',
      width: RPC_COLUMNS.checked,
      align: 'right',
      render: (row) => (
        <Text variant="monoSmall" tone="muted" align="right">
          {row.last_checked_at ? formatRelative(row.last_checked_at) : '—'}
        </Text>
      ),
    },
  ];

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Health"
          subtitle="Live operational state of the API, the RPC mesh and the provider integrations."
          actions={
            <Button
              label="Refresh"
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} color={colors.textSecondary} />}
              onPress={refreshAll}
            />
          }
        />

        {/* ── Service ──────────────────────────────────────────────── */}
        <View>
          <SectionHeader title="Service" subtitle="GET /health (unversioned in the backend)" />
          <Card variant="elevated" style={{ marginTop: spacing.md }}>
            {health.isError ? (
              <ErrorState
                title="Service unreachable"
                message={errorMessage(health.error)}
                retryable={isRetryable(health.error)}
                onRetry={() => void health.refetch()}
              />
            ) : health.isLoading ? (
              <SkeletonList count={2} lines={1} />
            ) : (
              <Stack gap={spacing.lg}>
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="overline" tone="muted">
                    Status
                  </Text>
                  <StatusBadge status={health.data?.status ?? 'unknown'} />
                </Row>
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="overline" tone="muted">
                    Vault
                  </Text>
                  <Row gap={spacing.sm}>
                    <StatusBadge
                      status={health.data?.vault_exists ? 'configured' : 'unconfigured'}
                      label={health.data?.vault_exists ? 'VAULT EXISTS' : 'NO VAULT'}
                      size="sm"
                    />
                    {health.data?.vault_exists ? (
                      <StatusBadge
                        status={health.data.vault_locked ? 'vault locked' : 'vault unlocked'}
                        size="sm"
                      />
                    ) : null}
                  </Row>
                </Row>
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="overline" tone="muted">
                    Realtime
                  </Text>
                  <ConnectionIndicator compact={false} showLastEvent />
                </Row>
              </Stack>
            )}
          </Card>
        </View>

        {/* ── RPC mesh ─────────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="RPC mesh"
            subtitle={
              endpoints.length > 0
                ? `${endpoints.length} endpoint${endpoints.length === 1 ? '' : 's'} · ${degraded} not OK`
                : 'Endpoints registered with the backend'
            }
            action={
              <Button
                label="Manage"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.rpc as never)}
              />
            }
          />
          <View style={{ marginTop: spacing.md }}>
            <DataTable
              columns={rpcColumns}
              data={endpoints}
              getRowKey={(row) => row.url}
              isLoading={rpc.isLoading}
              error={rpc.isError ? errorMessage(rpc.error) : null}
              onRetry={() => void rpc.refetch()}
              emptyTitle="No RPC endpoints"
              emptyHint="The backend has no RPC endpoint registered. Add one on the RPC page."
              emptyActionLabel="Open RPC"
              onEmptyAction={() => router.push(routes.rpc as never)}
              initialSort={{ key: 'status', direction: 'asc' }}
              caption={
                endpoints.length > 0
                  ? `Newest check ${formatDateTime(
                      endpoints
                        .map((e) => e.last_checked_at)
                        .filter(Boolean)
                        .sort()
                        .reverse()[0] ?? null,
                    )}`
                  : undefined
              }
            />
          </View>
        </View>

        {/* ── Providers ────────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Providers"
            subtitle="Which external integrations the backend has configured"
            action={
              <Button
                label="Details"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.providers as never)}
              />
            }
          />
          <Card variant="elevated" style={{ marginTop: spacing.md }}>
            {providers.isLoading ? (
              <SkeletonList count={3} lines={1} />
            ) : providers.isError ? (
              <ErrorState
                title="Providers unavailable"
                message={errorMessage(providers.error)}
                retryable={isRetryable(providers.error)}
                onRetry={() => void providers.refetch()}
              />
            ) : (providers.data ?? []).length === 0 ? (
              <Text variant="body" tone="muted" align="center">
                The backend reports no provider integrations.
              </Text>
            ) : (
              <Stack gap={spacing.md}>
                {(providers.data ?? []).map((provider) => (
                  <Row
                    key={provider.name}
                    justify="space-between"
                    align="center"
                    gap={spacing.lg}
                    wrap
                  >
                    <View style={styles.providerName}>
                      <Text variant="label" numberOfLines={1}>
                        {provider.name}
                      </Text>
                      <Text variant="monoSmall" tone="muted" numberOfLines={1}>
                        {provider.base_url ?? 'no base URL'}
                      </Text>
                    </View>
                    <Row gap={spacing.sm}>
                      {(provider.capabilities ?? []).map((capability) => (
                        <Text key={capability} variant="monoSmall" tone="muted">
                          {capability}
                        </Text>
                      ))}
                      <StatusBadge
                        status={provider.configured ? 'configured' : 'unconfigured'}
                        size="sm"
                      />
                    </Row>
                  </Row>
                ))}
              </Stack>
            )}
          </Card>
        </View>
      </Stack>
    </PageContainer>
  );
}

const styles = {
  providerName: { flex: 1, gap: spacing.xxs, minWidth: 160 },
} as const;