/**
 * WALLET / ACTIVITY — records attributed to one wallet.
 *
 * The backend exposes no wallet filter on `GET /activity`, so the scope is
 * applied client-side and the screen says so. That is stated in the UI rather
 * than hidden, because "filtered" and "not filterable" are different claims
 * and only one of them is true (DESIGN.md §1, §32).
 *
 * `signature` is not rendered as an index: the field is optional in the
 * backend record, so a signature column would be empty for most rows and
 * would imply a lookup capability that does not exist.
 *
 * Data: GET /activity
 */

import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { MetricCard, Tabs } from '@/components/data';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressDisplay } from '@/components/utility';
import { EmptyState, NoticeBanner } from '@/components/feedback/states';
import {
  errorMessage,
  useActivity,
  useWallet,
  type ActivityRecord,
} from '@/hooks/useApi';
import { routes, WALLET_DETAIL_TABS, walletDetailTabHref } from '@/navigation/config';
import { formatDateTime, formatRelative, titleCase } from '@/utils/format';

const COLUMNS = {
  type: 132,
  status: 124,
  amount: 120,
  destination: 176,
  when: 148,
} as const;

export default function WalletActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ walletId: string | string[] }>();
  const walletId = Array.isArray(params.walletId)
    ? (params.walletId[0] ?? null)
    : (params.walletId ?? null);

  const wallet = useWallet(walletId);
  const activity = useActivity(200);

  usePageMeta({
    title: 'Activity',
    subtitle: wallet.data ? `Records for ${wallet.data.label}` : 'Wallet activity',
    showWalletSelector: true,
    breadcrumbs: [
      { label: 'Wallets', href: routes.wallets },
      {
        label: wallet.data?.label ?? 'Wallet',
        href: walletId ? routes.walletDetail(walletId) : undefined,
      },
      { label: 'Activity' },
    ],
  });

  // DESIGN.md §1 — a client-side filter is labelled as one.
  const rows = useMemo(
    () =>
      walletId
        ? (activity.data ?? []).filter((record) => record.wallet_id === walletId)
        : (activity.data ?? []),
    [activity.data, walletId],
  );

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
          <Row gap={spacing.sm} justify="flex-end">
            <Text variant="monoSmall" tone="muted" align="right">
              {formatRelative(row.created_at)}
            </Text>
          </Row>
        ),
      },
    ],
    [],
  );

  if (!walletId) {
    return (
      <PageContainer>
        <EmptyState
          title="No wallet selected"
          hint="This screen needs a wallet in its address. Open the wallet list to choose one."
          actionLabel="Open wallets"
          onAction={() => router.replace(routes.wallets as never)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Activity"
          subtitle={`Every record the backend attributes to ${wallet.data?.label ?? 'this wallet'}.`}
          actions={
            <Button
              label="All activity"
              variant="tertiary"
              size="sm"
              onPress={() => router.push(routes.activity as never)}
            />
          }
        />

        <Tabs
          tabs={WALLET_DETAIL_TABS.map((tab) =>
            tab.key === 'activity' ? { ...tab, badge: rows.length } : { ...tab },
          )}
          active="activity"
          onChange={(key) => {
            if (key === 'activity') return;
            router.push(walletDetailTabHref(walletId, key) as never);
          }}
        />

        <MetricCard
          label="Records"
          value={String(rows.length)}
          sublabel={
            rows.length > 0
              ? `Most recent ${formatDateTime(rows[0]?.created_at)}`
              : 'No records attributed to this wallet'
          }
        />

        <NoticeBanner
          tone="neutral"
          title="Filtered in this app, not by the backend"
          message="GET /activity accepts only a limit. The wallet scope is applied here, so a wallet with no records reports zero even if the backend holds more than the requested page."
        />

        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          isLoading={activity.isLoading}
          error={activity.isError ? errorMessage(activity.error) : null}
          onRetry={() => void activity.refetch()}
          onRowPress={(row) => router.push(routes.activityDetail(row.id) as never)}
          emptyTitle="No activity for this wallet"
          emptyHint="The backend returned no records attributed to this wallet. Records appear once a sync has run."
          caption="Attributed records"
          onRefresh={() => void activity.refetch()}
          refreshing={activity.isRefetching}
          initialSort={{ key: 'created_at', direction: 'desc' }}
        />

        {/* Counterparty is a nullable, optional field — shown only when the
            backend actually returned one, never as a placeholder column. */}
        {rows.some((row) => row.counterparty) ? (
          <NoticeBanner
            tone="info"
            title="Counterparties reported"
            message={`${rows.filter((row) => row.counterparty).length} record${
              rows.filter((row) => row.counterparty).length === 1 ? '' : 's'
            } carry a counterparty. Open a record to see it. The address book itself is not implemented by the backend.`}
          />
        ) : null}
      </Stack>
    </PageContainer>
  );
}