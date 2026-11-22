/**
 * RPC — the endpoints the backend talks to.
 *
 * The only RPC surface with real telemetry: each endpoint reports its status,
 * latency, success and failure counts and when it was last checked. This is
 * the one infrastructure screen where the backend exposes enough to be worth
 * reading in full, so it gets the whole table rather than a summary card.
 *
 * Adding and removing an endpoint is supported by the backend
 * (`POST /rpc`, `DELETE /rpc?url=`), so both are offered — removal behind the
 * single confirmation dialog, and behind its own button rather than the row
 * itself, so no row can delete anything by accident.
 *
 * Data: GET /rpc, POST /rpc, DELETE /rpc
 */

import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, MetricCard, type FilterGroup } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { useConfirmDialog } from '@/components/feedback/confirmation-context';
import { NoticeBanner } from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useAddRpcEndpoint,
  useRemoveRpcEndpoint,
  useRpcEndpoints,
  type RpcEndpoint,
} from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatDateTime, formatLatency, formatNumber, titleCase } from '@/utils/format';

const COLUMNS = {
  url: 300,
  network: 120,
  status: 128,
  latency: 100,
  ok: 88,
  fail: 88,
  checked: 148,
  actions: 108,
} as const;

const ALL = 'all';

export default function RpcScreen() {
  const router = useRouter();
  const { confirm } = useConfirmDialog();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [url, setUrl] = useState('');
  const [network, setNetwork] = useState('mainnet-beta');
  const [urlError, setUrlError] = useState<string | undefined>(undefined);

  usePageMeta({
    title: 'RPC',
    subtitle: 'Endpoints the backend uses to reach Solana',
    breadcrumbs: [{ label: 'RPC' }],
  });

  const rpc = useRpcEndpoints();
  const add = useAddRpcEndpoint();
  const remove = useRemoveRpcEndpoint();

  const all = rpc.data ?? [];

  const healthy = useMemo(() => all.filter((e) => e.status === 'OK').length, [all]);
  const degraded = useMemo(
    () => all.filter((e) => e.status === 'DEGRADED' || e.status === 'RATE_LIMITED').length,
    [all],
  );
  const down = useMemo(
    () => all.filter((e) => e.status === 'DOWN' || e.status === 'ERROR').length,
    [all],
  );

  const rows = useMemo(
    () => (statusFilter === ALL ? all : all.filter((e) => e.status === statusFilter)),
    [all, statusFilter],
  );

  const statuses = useMemo(() => {
    const set = new Set(all.map((e) => e.status));
    return [...set].sort();
  }, [all]);

  const onAdd = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Enter the endpoint URL.');
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setUrlError('The URL must start with http:// or https://');
      return;
    }
    if (!network.trim()) {
      setUrlError('Enter the network label.');
      return;
    }
    setUrlError(undefined);
    add.mutate({ url: trimmed, network: network.trim() }, { onSuccess: () => setUrl('') });
  }, [url, network, add]);

  const onRemove = useCallback(
    async (endpoint: RpcEndpoint) => {
      const confirmed = await confirm({
        title: 'Remove this RPC endpoint?',
        message: `${endpoint.url}\n\nThe vault stops using this endpoint once it is removed. If it was the only one, backend requests may start failing until another is added.`,
        confirmLabel: 'Remove endpoint',
        tone: 'danger',
      });
      if (confirmed) remove.mutate(endpoint.url);
    },
    [confirm, remove],
  );

  const filterGroups: FilterGroup[] = [
    {
      key: 'status',
      label: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { key: ALL, label: 'All', count: all.length },
        ...statuses.map((value) => ({
          key: value,
          label: titleCase(value),
          count: all.filter((e) => e.status === value).length,
        })),
      ],
    },
  ];

  const columns: Column<RpcEndpoint>[] = useMemo(
    () => [
      {
        key: 'url',
        header: 'Endpoint',
        width: COLUMNS.url,
        sortable: true,
        sortValue: (row) => row.url,
        render: (row) => (
          <Text variant="monoSmall" numberOfLines={1}>
            {row.url}
          </Text>
        ),
      },
      {
        key: 'network',
        header: 'Network',
        width: COLUMNS.network,
        sortable: true,
        sortValue: (row) => row.network,
        render: (row) => (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {row.network}
          </Text>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: COLUMNS.status,
        sortable: true,
        sortValue: (row) => row.status,
        render: (row) => <StatusBadge status={row.status} size="sm" />,
      },
      {
        key: 'latency_ms',
        header: 'Latency',
        width: COLUMNS.latency,
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
        key: 'successes',
        header: 'OK',
        width: COLUMNS.ok,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.successes,
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {formatNumber(row.successes)}
          </Text>
        ),
      },
      {
        key: 'failures',
        header: 'Failed',
        width: COLUMNS.fail,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.failures,
        render: (row) => (
          <Text
            variant="monoSmall"
            tone={row.failures > 0 ? 'danger' : 'muted'}
            align="right"
          >
            {formatNumber(row.failures)}
          </Text>
        ),
      },
      {
        key: 'last_checked_at',
        header: 'Checked',
        width: COLUMNS.checked,
        align: 'right',
        sortable: true,
        sortValue: (row) => row.last_checked_at ?? '',
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {row.last_checked_at ? formatDateTime(row.last_checked_at) : 'Never'}
          </Text>
        ),
      },
      {
        key: 'actions',
        header: '',
        width: COLUMNS.actions,
        render: (row) => (
          <Button
            label="Remove"
            variant="tertiary"
            size="sm"
            loading={remove.isPending && remove.variables === row.url}
            onPress={() => void onRemove(row)}
          />
        ),
      },
    ],
    [onRemove, remove.isPending, remove.variables],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="RPC"
          subtitle="Endpoints the backend uses to reach Solana mainnet."
          badges={
            all.length > 0 ? (
              <StatusBadge
                status={down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'healthy'}
                label={
                  down > 0
                    ? `${down} DOWN`
                    : degraded > 0
                      ? `${degraded} DEGRADED`
                      : 'ALL ENDPOINTS OK'
                }
              />
            ) : null
          }
        />

        <MetricCard
          label="Endpoints"
          value={String(all.length)}
          sublabel={`${healthy} healthy · ${degraded} degraded or rate limited · ${down} down or errored`}
        />

        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.url}
          isLoading={rpc.isLoading}
          error={rpc.isError ? errorMessage(rpc.error) : null}
          onRetry={() => void rpc.refetch()}
          emptyTitle={all.length === 0 ? 'No RPC endpoints' : 'No endpoints match this status'}
          emptyHint={
            all.length === 0
              ? 'The backend has no endpoints registered. Add one below, or configure it on the backend.'
              : 'Change the status filter to see the other endpoints.'
          }
          caption="Endpoints"
          onRefresh={() => void rpc.refetch()}
          refreshing={rpc.isRefetching}
          initialSort={{ key: 'latency_ms', direction: 'asc' }}
          toolbar={
            <FilterBar
              groups={filterGroups}
              activeCount={statusFilter === ALL ? 0 : 1}
              onClear={() => setStatusFilter(ALL)}
            />
          }
        />

        {/* ── Add ─────────────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Add endpoint"
            subtitle="Registered on the backend — this app stores nothing"
          />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.lg}>
              <Input
                label="Endpoint URL"
                value={url}
                onChangeText={(next) => {
                  setUrl(next);
                  if (urlError) setUrlError(undefined);
                }}
                placeholder="https://api.mainnet-beta.solana.com"
                mono
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                error={urlError}
              />
              <Input
                label="Network"
                value={network}
                onChangeText={setNetwork}
                placeholder="mainnet-beta"
                mono
                autoCapitalize="none"
                autoCorrect={false}
                hint="Stored verbatim by the backend. Solana mainnet is the only supported network."
              />
              <Row gap={spacing.lg} align="center" wrap>
                <Button
                  label="Add endpoint"
                  variant="primary"
                  size="sm"
                  loading={add.isPending}
                  onPress={onAdd}
                />
                {add.isError ? (
                  <Text
                    variant="caption"
                    tone={isRetryable(add.error) ? 'warning' : 'danger'}
                    style={styles.flex}
                  >
                    {errorMessage(add.error)}
                  </Text>
                ) : null}
                {remove.isError ? (
                  <Text variant="caption" tone="danger" style={styles.flex}>
                    {errorMessage(remove.error)}
                  </Text>
                ) : null}
              </Row>
            </Stack>
          </Card>
        </View>

        <NoticeBanner
          tone="neutral"
          title="No per-endpoint test or priority"
          message="The backend exposes no way to probe an endpoint from here, and no reordering or priority setting. Status, latency and counters are whatever the backend last recorded. Removing an endpoint always asks for confirmation first."
        />

        <Button
          label="Networks & providers"
          variant="tertiary"
          size="sm"
          onPress={() => router.push(routes.providers as never)}
        />
      </Stack>
    </PageContainer>
  );
}

const styles = {
  flex: { flex: 1 },
} as const;