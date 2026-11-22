/**
 * WALLET / ASSETS — holdings for one wallet.
 *
 * A wallet-scoped slice of the same Assets table used app-wide: one table
 * implementation, one column set, one set of tokens. The only difference is
 * that the scope is fixed to this wallet rather than the global selector.
 *
 * Data: GET /assets?wallet_id=…, /portfolio/summary
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { MetricCard, Tabs } from '@/components/data';
import { DataTable, type Column } from '@/components/DataTable';
import { AddressDisplay, TokenIcon } from '@/components/utility';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, SkeletonList } from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useAssets,
  usePortfolioSummary,
  useWallet,
  type Asset,
} from '@/hooks/useApi';
import { routes, WALLET_DETAIL_TABS, walletDetailTabHref } from '@/navigation/config';
import { formatUsd, formatUsdCompact, shortenMint } from '@/utils/format';

const COLUMNS = {
  asset: 184,
  mint: 156,
  price: 104,
  value: 112,
  risk: 104,
  wallets: 96,
} as const;

export default function WalletAssetsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ walletId: string | string[] }>();
  const walletId = Array.isArray(params.walletId)
    ? (params.walletId[0] ?? null)
    : (params.walletId ?? null);

  const wallet = useWallet(walletId);
  const assets = useAssets({ walletId });
  const summary = usePortfolioSummary();

  usePageMeta({
    title: 'Assets',
    subtitle: wallet.data ? `Held by ${wallet.data.label}` : 'Wallet holdings',
    showWalletSelector: true,
    breadcrumbs: [
      { label: 'Wallets', href: routes.wallets },
      { label: wallet.data?.label ?? 'Wallet', href: walletId ? routes.walletDetail(walletId) : undefined },
      { label: 'Assets' },
    ],
  });

  const rows = assets.data ?? [];
  const total = rows.reduce((sum, asset) => sum + (asset.value_usd ?? 0), 0);

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
        key: 'risk',
        header: 'Risk',
        width: COLUMNS.risk,
        sortable: true,
        sortValue: (row) => row.risk ?? 'zzz',
        render: (row) => (row.risk ? <StatusBadge status={row.risk} size="sm" /> : null),
      },
      {
        key: 'wallet_ids',
        header: 'Wallets',
        width: COLUMNS.wallets,
        align: 'right',
        mono: true,
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {row.wallet_ids?.length ?? 0}
          </Text>
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
          title="Assets"
          subtitle={`Tokens the backend attributes to ${wallet.data?.label ?? 'this wallet'}.`}
          actions={
            <Button
              label="All assets"
              variant="tertiary"
              size="sm"
              onPress={() => router.push(routes.assets as never)}
            />
          }
        />

        <Tabs
          tabs={WALLET_DETAIL_TABS.map((tab) =>
            tab.key === 'assets' ? { ...tab, badge: rows.length } : { ...tab },
          )}
          active="assets"
          onChange={(key) => {
            if (key === 'assets') return;
            router.push(walletDetailTabHref(walletId, key) as never);
          }}
        />

        <View>
          <SectionHeader
            title="Total"
            subtitle="Sum of the attributed asset values reported by the backend"
          />
          <View style={{ marginTop: spacing.md }}>
            {assets.isError ? (
              <ErrorState
                title="Assets unavailable"
                message={errorMessage(assets.error)}
                hasStaleData={rows.length > 0}
                retryable={isRetryable(assets.error)}
                onRetry={() => void assets.refetch()}
              />
            ) : assets.isLoading ? (
              <SkeletonList count={1} lines={1} />
            ) : (
              <MetricCard
                label={wallet.data?.label ?? 'Wallet'}
                value={formatUsd(total)}
                sublabel={`${rows.length} asset${rows.length === 1 ? '' : 's'} · vault total ${formatUsd(
                  summary.data?.wallet_values_usd?.[walletId] ?? 0,
                )}`}
                testID="wallet-assets-total"
              />
            )}
          </View>
        </View>

        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.mint}
          isLoading={assets.isLoading}
          error={assets.isError ? errorMessage(assets.error) : null}
          onRetry={() => void assets.refetch()}
          onRowPress={(row) => router.push(routes.assetDetail(row.mint) as never)}
          emptyTitle="No assets recorded"
          emptyHint="Nothing is attributed to this wallet yet. Synchronisation runs on a backend interval."
          caption="Attributed assets"
          onRefresh={() => void assets.refetch()}
          refreshing={assets.isRefetching}
          initialSort={{ key: 'value_usd', direction: 'desc' }}
        />
      </Stack>
    </PageContainer>
  );
}