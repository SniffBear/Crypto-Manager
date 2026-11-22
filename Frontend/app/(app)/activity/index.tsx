/**
 * ACTIVITY — the vault-wide transaction timeline.
 *
 * Two honest constraints shape this screen, and both are stated in the UI
 * rather than hidden (DESIGN.md §1, §32):
 *
 *  1. `GET /activity` accepts a `limit` and nothing else. The wallet scope in
 *     the App Bar is therefore applied here, in the app, not by the backend.
 *  2. `signature` is an optional field on the record. It is shown when the
 *     backend supplies one and reported as unreported when it does not — it
 *     is not a linkable index, because no explorer lookup or signature
 *     endpoint exists.
 *
 * Data: GET /activity, /wallets (for the wallet filter labels)
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { FilterBar, MetricCard, Tabs, type FilterGroup } from '@/components/data';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressDisplay } from '@/components/utility';
import { NoticeBanner } from '@/components/feedback/states';
import { errorMessage, useActivity, useWallets, type ActivityRecord } from '@/hooks/useApi';
import { useWalletContext, ALL_WALLETS } from '@/stores/wallet-context';
import { DESTINATION_CHILDREN, routes } from '@/navigation/config';
import { formatDateTime, formatRelative, titleCase } from '@/utils/format';

const COLUMNS = {
  type: 136,
  status: 128,
  wallet: 148,
  amount: 112,
  destination: 172,
  when: 132,
} as const;

const ALL = 'all';

export default function ActivityScreen() {
  const router = useRouter();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const selectAll = useWalletContext((s) => s.selectAll);

  const [status, setStatus] = useState<string>(ALL);
  const [signatures, setSignatures] = useState<'all' | 'with' | 'without'>(ALL);

  usePageMeta({
    title: 'Activity',
    subtitle:
      selectedWalletId === ALL_WALLETS
        ? 'Every record the backend reports'
        : 'Records for the selected wallet',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Activity' }],
  });

  const activity = useActivity(200);
  const wallets = useWallets();

  const walletLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const wallet of wallets.data ?? []) map.set(wallet.id, wallet.label);
    return map;
  }, [wallets.data]);

  const scopeFiltered = useMemo(() => {
    const list = activity.data ?? [];
    return selectedWalletId ? list.filter((r) => r.wallet_id === selectedWalletId) : list;
  }, [activity.data, selectedWalletId]);

  const rows = useMemo(() => {
    let list = scopeFiltered;
    if (status !== ALL) list = list.filter((r) => r.status === status);
    if (signatures === 'with') list = list.filter((r) => Boolean(r.signature));
    if (signatures === 'without') list = list.filter((r) => !r.signature);
    return list;
  }, [scopeFiltered, status, signatures]);

  const statuses = useMemo(() => {
    const set = new Set((activity.data ?? []).map((r) => r.status));
    return [...set].sort();
  }, [activity.data]);

  const withSignature = (activity.data ?? []).filter((r) => Boolean(r.signature)).length;

  const filterGroups: FilterGroup[] = [
    {
      key: 'status',
      label: 'Status',
      value: status,
      onChange: setStatus,
      options: [
        { key: ALL, label: 'All', count: scopeFiltered.length },
        ...statuses.map((value) => ({
          key: value,
          label: titleCase(value),
          count: scopeFiltered.filter((r) => r.status === value).length,
        })),
      ],
    },
    {
      key: 'signature',
      label: 'Signature',
      value: signatures,
      onChange: (key) => setSignatures(key as 'all' | 'with' | 'without'),
      options: [
        { key: ALL, label: 'All', count: scopeFiltered.length },
        { key: 'with', label: 'Reported', count: withSignature },
        {
          key: 'without',
          label: 'Unreported',
          count: scopeFiltered.length - withSignature,
        },
      ],
    },
  ];

  const activeFilters = (status === ALL ? 0 : 1) + (signatures === ALL ? 0 : 1);

  const columns: Column<ActivityRecord>[] = useMemo(
    () => [
      {
        key: 'type',
        header: 'Type',
        width: COLUMNS.type,
        sortable: true,
        sortValue: (row) => row.type,
        render: (row) => (
          <Text variant="label" numberOfLines={1}>
            {titleCase(row.type)}
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
        key: 'wallet_id',
        header: 'Wallet',
        width: COLUMNS.wallet,
        sortable: true,
        sortValue: (row) => row.wallet_id ?? '',
        render: (row) =>
          row.wallet_id ? (
            <Text variant="caption" numberOfLines={1}>
              {walletLabels.get(row.wallet_id) ?? row.wallet_id}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              Not attributed
            </Text>
          ),
      },
      {
        key: 'amount',
        header: 'Amount',
        width: COLUMNS.amount,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.amount ?? -1,
        render: (row) => (
          <Text variant="monoSmall" tone="secondary" align="right">
            {row.amount ?? '—'}
          </Text>
        ),
      },
      {
        key: 'destination',
        header: 'Destination',
        width: COLUMNS.destination,
        render: (row) =>
          row.destination ? (
            <AddressDisplay value={row.destination} kind="destination" size="sm" />
          ) : (
            <Text variant="caption" tone="muted">
              —
            </Text>
          ),
      },
      {
        key: 'created_at',
        header: 'When',
        width: COLUMNS.when,
        align: 'right',
        sortable: true,
        sortValue: (row) => row.created_at,
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {formatRelative(row.created_at)}
          </Text>
        ),
      },
    ],
    [walletLabels],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Activity"
          subtitle="Every record the backend reports, newest first."
          actions={
            <Row gap={spacing.md}>
              {selectedWalletId !== ALL_WALLETS ? (
                <Button label="Show all wallets" variant="secondary" size="sm" onPress={selectAll} />
              ) : null}
              <Button
                label="Receive"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.receive as never)}
              />
            </Row>
          }
        />

        <Tabs
          tabs={DESTINATION_CHILDREN.activity.map((child) => ({
            key: child.href,
            label: child.label,
          }))}
          active={routes.activity}
          onChange={(href) => {
            if (href !== routes.activity) router.push(href as never);
          }}
        />

        <MetricCard
          label={selectedWalletId === ALL_WALLETS ? 'Records' : 'Records in scope'}
          value={String(rows.length)}
          sublabel={
            rows.length > 0
              ? `Most recent ${formatDateTime(rows[0]?.created_at)} · ${withSignature} with a signature`
              : 'No records match the current scope and filters'
          }
        />

        <NoticeBanner
          tone="neutral"
          title="Filtering happens in this app"
          message="GET /activity accepts a limit only. The wallet scope in the App Bar and the filters above are applied here, so the rows shown are the most recent page the backend returned — not a server-side query. Loading more requires a backend change."
        />

        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          isLoading={activity.isLoading}
          error={activity.isError ? errorMessage(activity.error) : null}
          onRetry={() => void activity.refetch()}
          onRowPress={(row) => router.push(routes.activityDetail(row.id) as never)}
          emptyTitle={
            selectedWalletId === ALL_WALLETS ? 'No activity yet' : 'No activity for this wallet'
          }
          emptyHint="Records appear once the backend has synchronised a wallet. There is no manual sync control — the workers run on an interval."
          caption="Records"
          onRefresh={() => void activity.refetch()}
          refreshing={activity.isRefetching}
          initialSort={{ key: 'created_at', direction: 'desc' }}
          toolbar={
            <FilterBar
              groups={filterGroups}
              activeCount={activeFilters}
              onClear={() => {
                setStatus(ALL);
                setSignatures(ALL);
              }}
            />
          }
        />
      </Stack>
    </PageContainer>
  );
}