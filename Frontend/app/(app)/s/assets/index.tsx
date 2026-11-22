/**
 * ASSETS — the token index.
 *
 * This is the app-wide asset explorer, scoped by the wallet context in the App
 * Bar and searched through the backend's own `search` parameter. It is
 * deliberately distinct from Vault / Portfolio: that screen is about *value
 * allocation*, this one is about *which tokens exist here and what is known
 * about them*. Same table component, different question.
 *
 * The token screener, which the mockups promised, is not implemented by the
 * backend and is declared as unavailable rather than approximated with client
 * side filters pretending to be a screener (DESIGN.md §1).
 *
 * Data: GET /assets?wallet_id=…&search=…, /portfolio/summary
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { FilterBar, MetricCard, SearchBar, type FilterGroup } from '@/components/data';
import { DataTable, type Column } from '@/components/DataTable';
import { AddressDisplay, TokenIcon } from '@/components/utility';
import { StatusBadge } from '@/components/StatusBadge';
import { NoticeBanner } from '@/components/feedback/states';
import { errorMessage, useScopedAssets, usePortfolioSummary, type Asset } from '@/hooks/useApi';
import { ALL_WALLETS, useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import { formatDate, formatUsd, formatUsdCompact, shortenMint, titleCase } from '@/utils/format';

const COLUMNS = {
  asset: 184,
  mint: 156,
  price: 104,
  value: 112,
  share: 84,
  risk: 112,
  updated: 108,
} as const;

const ALL = 'all';

export default function AssetsScreen() {
  const router = useRouter();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const selectAll = useWalletContext((s) => s.selectAll);

  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState(ALL);

  usePageMeta({
    title: 'Assets',
    subtitle:
      selectedWalletId === ALL_WALLETS
        ? 'Every token known to this vault'
        : 'Tokens held by the selected wallet',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Assets' }],
  });

  const assets = useScopedAssets(search);
  const summary = usePortfolioSummary();

  const scoped = assets.data ?? [];
  const rows = useMemo(
    () => (risk === ALL ? scoped : scoped.filter((a) => (a.risk ?? 'unknown') === risk)),
    [scoped, risk],
  );

  const total = scoped.reduce((sum, asset) => sum + (asset.value_usd ?? 0), 0);
  const risks = useMemo(() => {
    const set = new Set(scoped.map((asset) => asset.risk ?? 'unknown'));
    return [...set].sort();
  }, [scoped]);

  const filterGroups: FilterGroup[] = [
    {
      key: 'risk',
      label: 'Risk',
      value: risk,
      onChange: setRisk,
      options: [
        { key: ALL, label: 'All', count: scoped.length },
        ...risks.map((value) => ({
          key: value,
          label: titleCase(value),
          count: scoped.filter((a) => (a.risk ?? 'unknown') === value).length,
        })),
      ],
    },
  ];

  const columns: Column<Asset>[] = useMemo(
    () => [
      {
        key: 'symbol',
        header: 'Asset',
        width: COLUMNS.asset,
        sortable: true,
        sortValue: (row) => row.symbol ?? row.name ?? row.mint,
        render: (row) => (
          <Row gap={spacing.md} align="center">
            <TokenIcon mint={row.mint} symbol={row.symbol} size={28} />
            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {row.symbol ?? shortenMint(row.mint)}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {row.name ?? row.program ?? 'Unnamed token'}
              </Text>
            </View>
          </Row>
        ),
      },
      {
        key: 'mint',
        header: 'Mint',
        width: COLUMNS.mint,
        render: (row) => <AddressDisplay value={row.mint} kind="mint" size="sm" />,
      },
      {
        key: 'price_usd',
        header: 'Price',
        width: COLUMNS.price,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.price_usd ?? -1,
        render: (row) => (
          <Text variant="monoSmall" tone="secondary" align="right">
            {formatUsd(row.price_usd, { decimals: 4 })}
          </Text>
        ),
      },
      {
        key: 'value_usd',
        header: 'Value',
        width: COLUMNS.value,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.value_usd ?? -1,
        render: (row) => (
          <Text variant="monoSmall" align="right">
            {formatUsdCompact(row.value_usd)}
          </Text>
        ),
      },
      {
        key: 'share',
        header: 'Share',
        width: COLUMNS.share,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => (total ? (row.value_usd ?? 0) / total : 0),
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {total && row.value_usd ? `${((row.value_usd / total) * 100).toFixed(1)}%` : '—'}
          </Text>
        ),
      },
      {
        key: 'risk',
        header: 'Risk',
        width: COLUMNS.risk,
        sortable: true,
        sortValue: (row) => row.risk ?? 'zzz',
        render: (row) => <StatusBadge status={row.risk ?? 'unknown'} size="sm" />,
      },
      {
        key: 'updated_at',
        header: 'Updated',
        width: COLUMNS.updated,
        align: 'right',
        sortable: true,
        sortValue: (row) => row.updated_at ?? '',
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {formatDate(row.updated_at)}
          </Text>
        ),
      },
    ],
    [total],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Assets"
          subtitle="Every token the backend attributes to this vault, with the price and risk it reports."
          actions={
            <Row gap={spacing.md}>
              {selectedWalletId !== ALL_WALLETS ? (
                <Button label="Show all" variant="secondary" size="sm" onPress={selectAll} />
              ) : null}
              <Button
                label="Portfolio"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.vaultPortfolio as never)}
              />
            </Row>
          }
        />

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search symbol, name or mint"
        />

        <MetricCard
          label={selectedWalletId === ALL_WALLETS ? 'Tracked value' : 'Value in scope'}
          value={formatUsd(total)}
          sublabel={`${scoped.length} token${scoped.length === 1 ? '' : 's'}${
            search ? ` matching “${search}”` : ''
          } · vault total ${formatUsd(summary.data?.total_value_usd)}`}
        />

        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.mint}
          isLoading={assets.isLoading}
          error={assets.isError ? errorMessage(assets.error) : null}
          onRetry={() => void assets.refetch()}
          onRowPress={(row) => router.push(routes.assetDetail(row.mint) as never)}
          emptyTitle={search ? 'No token matches' : 'No assets yet'}
          emptyHint={
            search
              ? 'The backend search matched nothing. Try a shorter term, a mint, or clear the search.'
              : 'Assets appear once the backend has synchronised a wallet.'
          }
          caption="Tokens"
          onRefresh={() => void assets.refetch()}
          refreshing={assets.isRefetching}
          initialSort={{ key: 'value_usd', direction: 'desc' }}
          toolbar={
            <FilterBar
              groups={filterGroups}
              activeCount={risk === ALL ? 0 : 1}
              onClear={() => setRisk(ALL)}
            />
          }
        />

        <NoticeBanner
          tone="neutral"
          title="The filters above are not a screener"
          message="Risk and search are applied to what this vault already holds. The backend implements no screening, ranking or discovery endpoint, so the Token Screener declared in the menu is an explicit unavailable state rather than a set of client-side approximations."
        />
      </Stack>
    </PageContainer>
  );
}