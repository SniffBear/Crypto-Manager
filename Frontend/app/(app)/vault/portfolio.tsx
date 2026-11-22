/**
 * VAULT / PORTFOLIO — the per-wallet breakdown and the asset table.
 *
 * The headline total is the vault-wide figure the backend returns. The
 * per-wallet split comes from `wallet_values_usd` on the same payload, so no
 * extra request and no invented arithmetic.
 *
 * DESIGN.md §29 — the asset table is the one place a wide table is
 * justified, and it scrolls horizontally rather than shrinking type (§18).
 *
 * Data: GET /portfolio/summary, /assets
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta, useSheet } from '@/components/chrome/shell-context';
import { DataTable, type Column } from '@/components/DataTable';
import { MetricCard } from '@/components/data';
import { StatusBadge, StatusDot } from '@/components/StatusBadge';
import { TokenIcon } from '@/components/utility';
import { ErrorState, NoticeBanner, SkeletonList } from '@/components/feedback/states';
import { WalletSelector, useSelectedWallet } from '@/components/context/WalletSelector';
import {
  errorMessage,
  isRetryable,
  usePortfolioHistory,
  usePortfolioSummary,
  useScopedAssets,
  useWallets,
  type Asset,
} from '@/hooks/useApi';
import { ALL_WALLETS, useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import { formatNumber, formatUsd } from '@/utils/format';

const COLUMN = {
  asset: 168,
  value: 108,
  price: 96,
  risk: 92,
  wallets: 96,
  updated: 108,
} as const;

export default function PortfolioScreen() {
  const router = useRouter();
  const { open } = useSheet();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const select = useWalletContext((s) => s.select);
  const { selected } = useSelectedWallet();

  usePageMeta({
    title: 'Portfolio',
    subtitle: 'Per-wallet split and asset holdings',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Vault' }, { label: 'Portfolio' }],
  });

  const summary = usePortfolioSummary();
  const history = usePortfolioHistory(100);
  const wallets = useWallets();
  const assets = useScopedAssets();
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const walletRows = useMemo(() => {
    const list = wallets.data ?? [];
    const values = summary.data?.wallet_values_usd ?? {};
    return list
      .map((wallet) => ({ wallet, value: values[wallet.id] ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }, [wallets.data, summary.data]);

  const scopedTotal = useMemo(() => {
    if (selectedWalletId === ALL_WALLETS) return null;
    return summary.data?.wallet_values_usd?.[selectedWalletId] ?? null;
  }, [summary.data, selectedWalletId]);

  const columns: Column<Asset>[] = useMemo(
    () => [
      {
        key: 'asset',
        header: 'Asset',
        width: COLUMN.asset,
        sortable: true,
        sortValue: (row) => row.symbol ?? row.name ?? row.mint,
        render: (row) => (
          <Row gap={spacing.md} align="center">
            <TokenIcon mint={row.mint} symbol={row.symbol} size={26} />
            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {row.symbol ?? row.name ?? 'Unknown'}
              </Text>
              <Text variant="monoSmall" tone="muted" numberOfLines={1}>
                {row.name ?? row.mint}
              </Text>
            </View>
          </Row>
        ),
      },
      {
        key: 'value',
        header: 'Value',
        width: COLUMN.value,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.value_usd ?? 0,
        render: (row) => (
          <Text variant="monoSmall" align="right">
            {formatUsd(row.value_usd)}
          </Text>
        ),
      },
      {
        key: 'price',
        header: 'Price',
        width: COLUMN.price,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.price_usd ?? 0,
        render: (row) => (
          <Text variant="monoSmall" tone="secondary" align="right">
            {formatUsd(row.price_usd)}
          </Text>
        ),
      },
      {
        key: 'risk',
        header: 'Risk',
        width: COLUMN.risk,
        sortable: true,
        sortValue: (row) => row.risk ?? 'unknown',
        render: (row) => (row.risk ? <StatusBadge status={row.risk} size="sm" /> : <StatusDot status="unknown" />),
      },
      {
        key: 'wallets',
        header: 'Wallets',
        width: COLUMN.wallets,
        align: 'right',
        mono: true,
        render: (row) => (
          <Text variant="monoSmall" tone="secondary" align="right">
            {formatNumber(row.wallet_ids?.length ?? 0)}
          </Text>
        ),
      },
      {
        key: 'updated',
        header: 'Updated',
        width: COLUMN.updated,
        align: 'right',
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right" numberOfLines={1}>
            {row.updated_at ? new Date(row.updated_at).toISOString().slice(5, 16).replace('T', ' ') : '—'}
          </Text>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Portfolio"
          subtitle="What the vault holds, split by wallet and by asset."
          actions={
            <Button
              label="All assets"
              variant="secondary"
              size="sm"
              onPress={() => router.push(routes.assets as never)}
            />
          }
        />

        <View>
          <SectionHeader
            title="Portfolio history"
            subtitle="Persisted snapshots exposed by GET /portfolio/history"
          />
          <Card variant="elevated" style={{ marginTop: spacing.md }}>
            {history.isLoading ? (
              <SkeletonList count={4} lines={2} />
            ) : history.isError ? (
              <ErrorState
                title="History unavailable"
                message={errorMessage(history.error)}
                retryable={isRetryable(history.error)}
                onRetry={() => void history.refetch()}
              />
            ) : (history.data ?? []).length === 0 ? (
              <Text variant="body" tone="muted">
                No snapshots exist yet. Create a snapshot to establish the first historical point.
              </Text>
            ) : (
              <Stack gap={spacing.sm}>
                {(history.data ?? []).slice(0, 12).map((snapshot) => (
                  <Row key={snapshot.timestamp} justify="space-between" gap={spacing.lg}>
                    <Text variant="monoSmall" tone="muted">
                      {new Date(snapshot.timestamp).toISOString()}
                    </Text>
                    <Text variant="monoSmall">
                      {formatUsd(snapshot.total_value_usd)}
                    </Text>
                  </Row>
                ))}
              </Stack>
            )}
          </Card>
        </View>

        {/* ── Headline ─────────────────────────────────────────────── */}
        {summary.isError ? (
          <ErrorState
            title="Portfolio unavailable"
            message={errorMessage(summary.error)}
            retryable={isRetryable(summary.error)}
            onRetry={() => void summary.refetch()}
          />
        ) : (
          <Row gap={spacing.lg} wrap>
            <View style={styles.metric}>
              <MetricCard
                label="Vault total"
                value={formatUsd(summary.data?.total_value_usd)}
                sublabel={`${summary.data?.asset_count ?? 0} assets across ${summary.data?.wallet_count ?? 0} wallets`}
                testID="portfolio-total"
              />
            </View>
            {scopedTotal !== null ? (
              <View style={styles.metric}>
                <MetricCard
                  label={selected?.label ?? 'Selected wallet'}
                  value={formatUsd(scopedTotal)}
                  sublabel="Share of the vault"
                  tone="accent"
                  onPress={() => select(ALL_WALLETS)}
                />
              </View>
            ) : null}
          </Row>
        )}

        {/* ── Wallet context control ───────────────────────────────── */}
        <View>
          <SectionHeader title="Wallet context" subtitle="Applies to the asset table below" />
          <View style={{ marginTop: spacing.md }}>
            <WalletSelector variant="inline" />
          </View>
        </View>

        {/* ── Per-wallet split ─────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="By wallet"
            subtitle="Values reported by GET /portfolio/summary"
            action={
              <Button
                label="Wallets"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.wallets as never)}
              />
            }
          />
          <Card padded={false} style={{ marginTop: spacing.md }}>
            {wallets.isLoading ? (
              <View style={styles.padded}>
                <SkeletonList count={3} lines={1} />
              </View>
            ) : walletRows.length === 0 ? (
              <View style={styles.padded}>
                <Text variant="body" tone="muted" align="center">
                  No wallets in this vault yet.
                </Text>
              </View>
            ) : (
              <Stack gap={spacing.sm} style={styles.padded}>
                {walletRows.map(({ wallet, value }) => {
                  const active = wallet.id === selectedWalletId;
                  return (
                    <Button
                      key={wallet.id}
                      label={`${wallet.label} · ${formatUsd(value)}`}
                      variant={active ? 'primary' : 'secondary'}
                      onPress={() => select(active ? ALL_WALLETS : wallet.id)}
                    />
                  );
                })}
              </Stack>
            )}
          </Card>
        </View>

        {/* ── Asset table ──────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Assets"
            subtitle={
              selectedWalletId === ALL_WALLETS
                ? 'Every asset held by any wallet'
                : 'Assets held by the selected wallet'
            }
            action={
              <Button
                label="Filter"
                variant="tertiary"
                size="sm"
                onPress={() =>
                  open({
                    title: 'Asset filters',
                    subtitle: 'Risk buckets and wallet scope',
                    render: (close) => (
                      <AssetFilterSheet
                        selectedWalletId={selectedWalletId}
                        onSelectWallet={select}
                        onClose={close}
                      />
                    ),
                  })
                }
              />
            }
          />
          <View style={{ marginTop: spacing.md }}>
            <DataTable
              columns={columns}
              data={assets.data ?? []}
              getRowKey={(row) => row.mint}
              isLoading={assets.isLoading}
              error={assets.isError ? errorMessage(assets.error) : null}
              onRetry={() => void assets.refetch()}
              onRowPress={(row) => router.push(routes.assetDetail(row.mint) as never)}
              emptyTitle="No assets"
              emptyHint={
                selectedWalletId === ALL_WALLETS
                  ? 'No wallet in this vault holds a token balance yet.'
                  : 'The selected wallet holds no token balance yet.'
              }
              initialSort={{ key: 'value', direction: 'desc' }}
            />
          </View>
        </View>
      </Stack>
    </PageContainer>
  );
}

function AssetFilterSheet({
  selectedWalletId,
  onSelectWallet,
  onClose,
}: {
  selectedWalletId: string | null;
  onSelectWallet: (id: string | null) => void;
  onClose: () => void;
}) {
  const wallets = useWallets();
  return (
    <Stack gap={spacing.md}>
      <Button
        label="All wallets"
        variant={selectedWalletId === ALL_WALLETS ? 'primary' : 'secondary'}
        fullWidth
        onPress={() => onSelectWallet(ALL_WALLETS)}
      />
      <Text variant="overline" tone="muted">
        Individual wallets
      </Text>
      {(wallets.data ?? []).map((wallet) => (
        <Button
          key={wallet.id}
          label={wallet.label}
          variant={selectedWalletId === wallet.id ? 'primary' : 'secondary'}
          fullWidth
          onPress={() => onSelectWallet(wallet.id)}
        />
      ))}
      <Button label="Done" variant="tertiary" fullWidth onPress={onClose} />
    </Stack>
  );
}

const styles = {
  metric: { flexGrow: 1, flexBasis: 220 },
  padded: { padding: spacing.xl },
} as const;