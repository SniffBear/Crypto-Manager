/**
 * WALLETS — the custody list.
 *
 * One table, one set of columns, one sort. DESIGN.md §29 — the columns are
 * fixed-width so the table never reflows, and wide screens scroll rather than
 * compressing type (§18).
 *
 * The wallet context is changed from here, which is why the WalletSelector is
 * in the App Bar for this screen: selecting a row scopes the whole app.
 *
 * Data: GET /wallets, /portfolio/summary
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, Plus } from 'lucide-react-native';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, type FilterGroup } from '@/components/data';
import { StatusBadge, StatusDot } from '@/components/StatusBadge';
import { AddressDisplay, WalletAvatar } from '@/components/utility';
import { ErrorState } from '@/components/feedback/states';
import { WalletSelector } from '@/components/context/WalletSelector';
import { errorMessage, isRetryable, usePortfolioSummary, useWallets, type Wallet } from '@/hooks/useApi';
import { ALL_WALLETS, useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import { formatDate, formatUsd } from '@/utils/format';

const COLUMNS = {
  wallet: 176,
  address: 168,
  role: 116,
  value: 108,
  signing: 128,
  created: 104,
} as const;

type RoleFilter = 'all' | 'standard' | 'watch_only' | 'cold';

export default function WalletsScreen() {
  const router = useRouter();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const select = useWalletContext((s) => s.select);

  const [role, setRole] = useState<RoleFilter>('all');

  usePageMeta({
    title: 'Wallets',
    subtitle: 'Custody, permissions and value',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Wallets' }],
  });

  const wallets = useWallets();
  const summary = usePortfolioSummary();

  const filtered = useMemo(() => {
    const list = wallets.data ?? [];
    if (role === 'all') return list;
    if (role === 'watch_only') return list.filter((w) => w.watch_only);
    if (role === 'cold') return list.filter((w) => w.cold_storage);
    return list.filter((w) => !w.watch_only && !w.cold_storage);
  }, [wallets.data, role]);

  const filterGroups: FilterGroup[] = [
    {
      key: 'role',
      label: 'Role',
      value: role,
      onChange: (next) => setRole(next as RoleFilter),
      options: [
        { key: 'all', label: 'All', count: wallets.data?.length ?? 0 },
        {
          key: 'standard',
          label: 'Standard',
          count: (wallets.data ?? []).filter((w) => !w.watch_only && !w.cold_storage).length,
        },
        {
          key: 'watch_only',
          label: 'Watch only',
          count: (wallets.data ?? []).filter((w) => w.watch_only).length,
        },
        {
          key: 'cold',
          label: 'Cold',
          count: (wallets.data ?? []).filter((w) => w.cold_storage).length,
        },
      ],
    },
  ];

  const columns: Column<Wallet>[] = useMemo(
    () => [
      {
        key: 'wallet',
        header: 'Wallet',
        width: COLUMNS.wallet,
        sortable: true,
        sortValue: (row) => row.label,
        render: (row) => (
          <Row gap={spacing.md} align="center">
            <WalletAvatar address={row.address} label={row.label} size={28} />
            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {row.label}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {row.group ?? 'Ungrouped'}
              </Text>
            </View>
          </Row>
        ),
      },
      {
        key: 'address',
        header: 'Address',
        width: COLUMNS.address,
        render: (row) => <AddressDisplay value={row.address} kind="wallet address" size="sm" />,
      },
      {
        key: 'role',
        header: 'Role',
        width: COLUMNS.role,
        sortable: true,
        sortValue: (row) => row.role,
        render: (row) => (
          <Row gap={spacing.sm}>
            <StatusDot status={row.watch_only ? 'watch only' : row.cold_storage ? 'cold storage' : 'ok'} />
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {row.role.replace(/_/g, ' ')}
            </Text>
          </Row>
        ),
      },
      {
        key: 'value',
        header: 'Value',
        width: COLUMNS.value,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => summary.data?.wallet_values_usd?.[row.id] ?? 0,
        render: (row) => (
          <Text variant="monoSmall" align="right">
            {formatUsd(summary.data?.wallet_values_usd?.[row.id] ?? 0)}
          </Text>
        ),
      },
      {
        key: 'signing',
        header: 'Permissions',
        width: COLUMNS.signing,
        render: (row) => (
          <Row gap={spacing.sm}>
            <StatusBadge
              status={row.signing_enabled ? 'signing enabled' : 'signing disabled'}
              size="sm"
            />
          </Row>
        ),
      },
      {
        key: 'created',
        header: 'Created',
        width: COLUMNS.created,
        align: 'right',
        sortable: true,
        sortValue: (row) => row.created_at,
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {formatDate(row.created_at)}
          </Text>
        ),
      },
    ],
    [summary.data],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Wallets"
          subtitle="Every wallet in this vault, with its custody role and permissions."
          actions={
            <Row gap={spacing.md}>
              <Button
                label="Import"
                variant="secondary"
                size="sm"
                icon={<Download size={14} color={colors.textSecondary} />}
                onPress={() => router.push(routes.walletsImport as never)}
              />
              <Button
                label="Create"
                variant="primary"
                size="sm"
                icon={<Plus size={14} color={colors.onAccent} />}
                onPress={() => router.push(routes.walletsCreate as never)}
              />
            </Row>
          }
        />

        {/* ── Wallet context ───────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Wallet context"
            subtitle="Scopes portfolio, assets, activity, alerts, risk and accounting"
            action={
              selectedWalletId !== ALL_WALLETS ? (
                <Button
                  label="Show all"
                  variant="tertiary"
                  size="sm"
                  onPress={() => select(ALL_WALLETS)}
                />
              ) : undefined
            }
          />
          <View style={{ marginTop: spacing.md }}>
            <WalletSelector variant="inline" />
          </View>
        </View>

        {/* ── Table ────────────────────────────────────────────────── */}
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(row) => row.id}
          selectedKey={selectedWalletId}
          isLoading={wallets.isLoading}
          error={wallets.isError ? errorMessage(wallets.error) : null}
          onRetry={() => void wallets.refetch()}
          onRowPress={(row) => router.push(routes.walletDetail(row.id) as never)}
          emptyTitle={role === 'all' ? 'No wallets yet' : 'No wallets match this filter'}
          emptyHint={
            role === 'all'
              ? 'Create a wallet, or import one you already hold.'
              : 'Change the role filter to see the other wallets.'
          }
          emptyActionLabel={role === 'all' ? 'Create wallet' : undefined}
          onEmptyAction={
            role === 'all' ? () => router.push(routes.walletsCreate as never) : undefined
          }
          initialSort={{ key: 'wallet', direction: 'asc' }}
          toolbar={
            <Card variant="flat" style={styles.toolbar}>
              <FilterBar groups={filterGroups} onClear={() => setRole('all')} activeCount={role === 'all' ? 0 : 1} />
            </Card>
          }
        />

        {/* ── Groups ───────────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Groups"
            subtitle="Labels used to organise wallets"
            action={
              <Button
                label="Open"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.walletsGroups as never)}
              />
            }
          />
          <GroupSummary wallets={wallets.data ?? []} />
        </View>
      </Stack>
    </PageContainer>
  );
}

function GroupSummary({ wallets }: { wallets: Wallet[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const wallet of wallets) {
      const key = wallet.group ?? 'Ungrouped';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [wallets]);

  if (groups.length === 0) {
    return (
      <Card style={{ marginTop: spacing.md }}>
        <Text variant="body" tone="muted" align="center">
          No wallets to group yet.
        </Text>
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: spacing.md }}>
      <Stack gap={spacing.md}>
        {groups.map(([name, count]) => (
          <Row key={name} justify="space-between" align="center" gap={spacing.lg}>
            <Text variant="body" numberOfLines={1} style={styles.groupName}>
              {name}
            </Text>
            <Text variant="monoSmall" tone="secondary">
              {count}
            </Text>
          </Row>
        ))}
      </Stack>
    </Card>
  );
}

const styles = {
  toolbar: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  groupName: { flex: 1 },
} as const;