/**
 * WALLET DETAIL — overview for a single wallet.
 *
 * DESIGN.md §12 — the detail route is where the wallet context is *pinned*:
 * opening a wallet makes it the authoritative selection for the whole app, so
 * Assets, Activity, Alerts, Risk and Accounting all narrow to it. Leaving the
 * context pinned is visible and reversible from the header.
 *
 * The four detail routes (Overview / Assets / Activity / Security) are one
 * destination with tabs, not four unrelated pages — DESIGN.md §3.6/§21.
 *
 * Data: GET /wallets/{id}, /portfolio/summary, /assets, /activity
 */

import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, KeyValue, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { ListRow, MetricCard, Tabs } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressDisplay, WalletAvatar } from '@/components/utility';
import {
  EmptyState,
  ErrorState,
  NoticeBanner,
  SkeletonList,
} from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useActivity,
  useAssets,
  usePortfolioSummary,
  useWallet,
} from '@/hooks/useApi';
import { ALL_WALLETS, useWalletContext } from '@/stores/wallet-context';
import {
  routes,
  WALLET_DETAIL_TABS,
  walletDetailTabHref,
} from '@/navigation/config';
import { formatDate, formatUsd, humanize, shortenMint, titleCase } from '@/utils/format';

const RECENT_ACTIVITY = 4;

export default function WalletDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ walletId: string | string[] }>();
  const walletId = Array.isArray(params.walletId)
    ? (params.walletId[0] ?? null)
    : (params.walletId ?? null);

  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const select = useWalletContext((s) => s.select);

  // DESIGN.md §12 — the deep link becomes the authoritative selection.
  useEffect(() => {
    if (walletId && selectedWalletId !== walletId) select(walletId);
  }, [walletId, selectedWalletId, select]);

  const wallet = useWallet(walletId);
  const summary = usePortfolioSummary();
  const assets = useAssets({ walletId });
  // The backend has no activity wallet filter, so the scope is applied here
  // rather than by inventing a query parameter.
  const activity = useActivity(100);

  usePageMeta({
    title: wallet.data?.label ?? 'Wallet',
    subtitle: wallet.data ? humanize(wallet.data.role) : 'Wallet detail',
    showWalletSelector: true,
    breadcrumbs: [
      { label: 'Wallets', href: routes.wallets },
      { label: wallet.data?.label ?? 'Detail' },
    ],
  });

  const scoped = selectedWalletId === walletId;
  const assetsHere = assets.data ?? [];
  const value = walletId ? (summary.data?.wallet_values_usd?.[walletId] ?? 0) : 0;
  const recent = walletId ? filterByWallet(activity.data, walletId, RECENT_ACTIVITY) : [];

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
          title={wallet.data?.label ?? 'Wallet'}
          subtitle={
            wallet.data
              ? `${humanize(wallet.data.role)}${wallet.data.group ? ` · ${wallet.data.group}` : ''}`
              : 'Loading wallet…'
          }
          badges={
            wallet.data ? (
              <>
                {wallet.data.watch_only ? <StatusBadge status="watch only" size="sm" /> : null}
                {wallet.data.cold_storage ? <StatusBadge status="cold storage" size="sm" /> : null}
                <StatusBadge
                  status={wallet.data.signing_enabled ? 'signing enabled' : 'signing disabled'}
                  size="sm"
                />
              </>
            ) : null
          }
          actions={
            selectedWalletId !== ALL_WALLETS ? (
              <Button
                label="Clear context"
                variant="tertiary"
                size="sm"
                onPress={() => select(ALL_WALLETS)}
              />
            ) : undefined
          }
        />

        <Tabs
          tabs={WALLET_DETAIL_TABS.map((tab) =>
            tab.key === 'assets' ? { ...tab, badge: assets.data?.length } : { ...tab },
          )}
          active="overview"
          onChange={(key) => {
            if (key === 'overview') return;
            router.push(walletDetailTabHref(walletId, key) as never);
          }}
        />

        {!scoped ? (
          <NoticeBanner
            tone="info"
            title="Wallet context applies to this app"
            message="Assets, activity, alerts, risk and accounting are filtered to this wallet until you clear the context."
          />
        ) : null}

        {wallet.isLoading ? (
          <SkeletonList count={4} />
        ) : wallet.isError ? (
          <ErrorState
            title="Wallet unavailable"
            message={errorMessage(wallet.error)}
            retryable={isRetryable(wallet.error)}
            onRetry={() => void wallet.refetch()}
          />
        ) : !wallet.data ? (
          <EmptyState
            title="Wallet not found"
            hint="The backend returned no wallet for this address. It may have been removed."
            actionLabel="Back to wallets"
            onAction={() => router.replace(routes.wallets as never)}
          />
        ) : (
          <>
            {/* ── Identity ─────────────────────────────────────────── */}
            <Card>
              <Stack gap={spacing.lg}>
                <Row gap={spacing.lg} align="center">
                  <WalletAvatar address={wallet.data.address} label={wallet.data.label} size={44} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text variant="h3" numberOfLines={1}>
                      {wallet.data.label}
                    </Text>
                    <AddressDisplay value={wallet.data.address} kind="wallet address" />
                  </View>
                </Row>
                <Divider />
                <KeyValue label="Wallet id" value={wallet.data.id} />
                <KeyValue label="Role" value={humanize(wallet.data.role)} />
                <KeyValue
                  label="Group"
                  value={wallet.data.group?.trim() ? wallet.data.group : 'Ungrouped'}
                />
                <KeyValue label="Created" value={formatDate(wallet.data.created_at)} />
              </Stack>
            </Card>

            {/* ── Value ────────────────────────────────────────────── */}
            <View>
              <SectionHeader title="Value" subtitle="From the vault-wide portfolio summary" />
              <View style={{ marginTop: spacing.md }}>
                <MetricCard
                  label={wallet.data.label}
                  value={formatUsd(value)}
                  sublabel={`${assetsHere.length} asset${assetsHere.length === 1 ? '' : 's'} held`}
                  onPress={() => router.push(routes.walletAssets(walletId) as never)}
                  testID="wallet-value"
                />
              </View>
            </View>

            {/* ── Permissions ──────────────────────────────────────── */}
            <View>
              <SectionHeader
                title="Permissions"
                subtitle="What this wallet is allowed to do"
              />
              <Card style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.xs}>
                  <PermissionRow
                    label="Watch only"
                    granted={wallet.data.watch_only}
                    onHint="Cannot sign or broadcast"
                    offHint="Full custody key held by the vault"
                  />
                  <PermissionRow
                    label="Cold storage"
                    granted={wallet.data.cold_storage}
                    onHint="Held for long-term storage"
                    offHint="Available for routine use"
                  />
                  <PermissionRow
                    label="Signing"
                    granted={wallet.data.signing_enabled}
                    onHint="Can sign transactions"
                    offHint="Signing is disabled"
                  />
                  <PermissionRow
                    label="Broadcasting"
                    granted={wallet.data.broadcasting_enabled}
                    onHint="Can submit to the network"
                    offHint="Broadcasting is disabled"
                  />
                  <PermissionRow
                    label="Secret export"
                    granted={wallet.data.secret_export_enabled}
                    onHint="Secret key may be revealed"
                    offHint="Secret key is never revealed"
                  />
                </Stack>
              </Card>
            </View>

            {/* ── Holdings ─────────────────────────────────────────── */}
            <View>
              <SectionHeader
                title="Holdings"
                subtitle="Assets attributed to this wallet"
                action={
                  <Button
                    label="Open"
                    variant="tertiary"
                    size="sm"
                    onPress={() => router.push(routes.walletAssets(walletId) as never)}
                  />
                }
              />
              <View style={{ marginTop: spacing.md }}>
                {assets.isLoading ? (
                  <SkeletonList count={2} />
                ) : assets.isError ? (
                  <ErrorState
                    title="Assets unavailable"
                    message={errorMessage(assets.error)}
                    hasStaleData={assetsHere.length > 0}
                    retryable={isRetryable(assets.error)}
                    onRetry={() => void assets.refetch()}
                  />
                ) : assetsHere.length === 0 ? (
                  <EmptyState
                    title="No assets recorded"
                    hint="Nothing is attributed to this wallet yet. Sync runs on a backend interval."
                    compact
                  />
                ) : (
                  <Card padded={false}>
                    <Stack gap={spacing.sm}>
                      {assetsHere.slice(0, 4).map((asset) => (
                        <ListRow
                          key={asset.mint}
                          title={asset.symbol ?? shortenMint(asset.mint)}
                          subtitle={asset.name ?? 'Unnamed token'}
                          meta={shortenMint(asset.mint)}
                          trailing={
                            <Text variant="monoSmall">{formatUsd(asset.value_usd)}</Text>
                          }
                          onPress={() => router.push(routes.assetDetail(asset.mint) as never)}
                        />
                      ))}
                    </Stack>
                  </Card>
                )}
              </View>
            </View>

            {/* ── Notes + tags ────────────────────────────────────── */}
            {wallet.data.notes || wallet.data.tags.length > 0 ? (
              <View>
                <SectionHeader title="Notes" />
                <Card style={{ marginTop: spacing.md }}>
                  <Stack gap={spacing.md}>
                    {wallet.data.notes ? (
                      <Text variant="body" tone="secondary">
                        {wallet.data.notes}
                      </Text>
                    ) : null}
                    {wallet.data.tags.length > 0 ? (
                      <Row gap={spacing.sm} wrap>
                        {wallet.data.tags.map((tag) => (
                          <StatusBadge key={tag} status={tag} size="sm" />
                        ))}
                      </Row>
                    ) : null}
                  </Stack>
                </Card>
              </View>
            ) : null}

            {/* ── Recent activity ─────────────────────────────────── */}
            <View>
              <SectionHeader
                title="Recent activity"
                subtitle="Records belonging to this wallet"
                action={
                  <Button
                    label="See all"
                    variant="tertiary"
                    size="sm"
                    onPress={() => router.push(routes.walletActivity(walletId) as never)}
                  />
                }
              />
              <View style={{ marginTop: spacing.md }}>
                {activity.isLoading ? (
                  <SkeletonList count={2} />
                ) : recent.length === 0 ? (
                  <EmptyState
                    title="No activity for this wallet"
                    hint="The backend returned no records attributed to this wallet."
                    compact
                  />
                ) : (
                  <Card padded={false}>
                    <Stack gap={spacing.sm}>
                      {recent.map((record) => (
                        <ListRow
                          key={record.id}
                          title={titleCase(record.type)}
                          subtitle={titleCase(record.status)}
                          badges={<StatusBadge status={record.status} size="sm" />}
                          onPress={() =>
                            router.push(routes.activityDetail(record.id) as never)
                          }
                        />
                      ))}
                    </Stack>
                  </Card>
                )}
              </View>
            </View>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}

function PermissionRow({
  label,
  granted,
  onHint,
  offHint,
}: {
  label: string;
  granted: boolean;
  onHint: string;
  offHint: string;
}) {
  return (
    <Row justify="space-between" align="center" gap={spacing.lg}>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="muted">
          {granted ? onHint : offHint}
        </Text>
      </View>
      <StatusBadge status={granted ? 'granted' : 'denied'} size="sm" />
    </Row>
  );
}

/** Client-side wallet scope for activity — the backend cannot filter. */
function filterByWallet<T extends { wallet_id: string | null }>(
  records: T[] | undefined,
  walletId: string,
  limit: number,
): T[] {
  return (records ?? []).filter((record) => record.wallet_id === walletId).slice(0, limit);
}