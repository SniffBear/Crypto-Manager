/**
 * VAULT — the command centre.
 *
 * This is the single landing destination of the authenticated application.
 * It answers four questions and nothing else: how much is held, how many
 * wallets back it, what needs attention, and what happened recently.
 *
 * DESIGN.md §18 (crowding is high priority) is why this is a short column of
 * distinct panels rather than a dense dashboard of eight tiles: each panel
 * loads, fails and empties independently.
 *
 * Data: GET /portfolio/summary, /wallets, /assets, /activity, /alerts, /risk/overview
 */

import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta, useSheet } from '@/components/chrome/shell-context';
import { AllTabs } from '@/components/chrome/AllTabs';
import { ListRow, MetricCard } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { WalletAvatar } from '@/components/utility';
import {
  EmptyState,
  ErrorState,
  NoticeBanner,
  SkeletonList,
} from '@/components/feedback/states';
import { ConnectionIndicator } from '@/components/context/ConnectionIndicator';
import {
  errorMessage,
  isRetryable,
  useActivity,
  useAlerts,
  usePortfolioSummary,
  useRiskOverview,
  useScopedAssets,
  useWallets,
} from '@/hooks/useApi';
import { ALL_WALLETS, useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import { formatRelative, formatUsd, titleCase } from '@/utils/format';

const RECENT_ACTIVITY = 5;

export default function VaultHomeScreen() {
  const router = useRouter();
  const { open } = useSheet();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const selectAll = useWalletContext((s) => s.selectAll);

  usePageMeta({
    title: 'Vault',
    subtitle:
      selectedWalletId === ALL_WALLETS
        ? 'All wallets · Solana mainnet'
        : 'Wallet context applied · Solana mainnet',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Home' }],
  });

  const summary = usePortfolioSummary();
  const wallets = useWallets();
  const assets = useScopedAssets();
  const activity = useActivity(RECENT_ACTIVITY);
  const alerts = useAlerts(true);
  const risk = useRiskOverview();

  const refreshAll = useCallback(() => {
    void summary.refetch();
    void wallets.refetch();
    void assets.refetch();
    void activity.refetch();
    void alerts.refetch();
    void risk.refetch();
  }, [summary, wallets, assets, activity, alerts, risk]);

  const unread = alerts.data ?? [];
  const criticalCount = unread.filter((alert) => alert.level === 'critical').length;
  const recent = activity.data ?? [];
  const walletCount = wallets.data?.length ?? 0;

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        {criticalCount > 0 ? (
          <NoticeBanner
            tone="warning"
            title={`${criticalCount} critical alert${criticalCount === 1 ? '' : 's'} unread`}
            message="Review the Alert Center before acting on balances or transfers."
          />
        ) : null}

        {/* ── Headline ─────────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Portfolio"
            subtitle={
              summary.data
                ? `${summary.data.asset_count} assets · ${summary.data.wallet_count} wallets`
                : undefined
            }
            action={
              <Button
                label="Open"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.vaultPortfolio as never)}
              />
            }
          />
          <View style={{ marginTop: spacing.md }}>
            {summary.isError ? (
              <ErrorState
                title="Portfolio unavailable"
                message={errorMessage(summary.error)}
                hasStaleData={Boolean(summary.data)}
                retryable={isRetryable(summary.error)}
                onRetry={() => void summary.refetch()}
              />
            ) : summary.isLoading ? (
              <Card>
                <Stack gap={spacing.lg}>
                  <Text variant="overline" tone="muted">
                    Total value
                  </Text>
                  <SkeletonList count={1} lines={1} />
                </Stack>
              </Card>
            ) : (
              <MetricCard
                label="Total value"
                value={formatUsd(summary.data?.total_value_usd)}
                sublabel={
                  selectedWalletId === ALL_WALLETS
                    ? 'Aggregated across every wallet in the vault'
                    : 'Vault-wide total; open Portfolio for the per-wallet split'
                }
                onPress={() => router.push(routes.vaultPortfolio as never)}
                testID="vault-total"
              />
            )}
          </View>
        </View>

        {selectedWalletId !== ALL_WALLETS ? (
          <Button label="Clear wallet context" variant="ghost" size="sm" onPress={selectAll} />
        ) : null}

        {/* ── Attention ────────────────────────────────────────────── */}
        <View>
          <SectionHeader title="Needs attention" />
          <Stack gap={spacing.md} style={{ marginTop: spacing.md }}>
            <Card variant={unread.length > 0 ? 'warning' : 'default'} padded={false}>
              <ListRow
                title="Unread alerts"
                subtitle={
                  unread.length === 0
                    ? 'Nothing awaiting review'
                    : criticalCount > 0
                      ? `${criticalCount} critical · ${unread.length - criticalCount} other`
                      : `${unread.length} awaiting review`
                }
                leading={<StatusBadge status={unread.length > 0 ? 'warning' : 'ok'} size="sm" />}
                onPress={() => router.push(routes.alerts as never)}
                testID="home-alerts"
              />
            </Card>

            <Card padded={false}>
              <ListRow
                title="Asset risk"
                subtitle={
                  risk.isLoading
                    ? 'Loading risk buckets…'
                    : risk.data
                      ? `${risk.data.asset_risk_buckets.high} high · ${risk.data.asset_risk_buckets.medium} medium · ${risk.data.asset_risk_buckets.low} low · ${risk.data.asset_risk_buckets.unknown} unknown`
                      : 'Risk overview unavailable'
                }
                leading={
                  <StatusBadge
                    status={
                      risk.data
                        ? risk.data.asset_risk_buckets.high > 0
                          ? 'degraded'
                          : 'healthy'
                        : 'unknown'
                    }
                    size="sm"
                  />
                }
                onPress={() => router.push(routes.risk as never)}
                testID="home-risk"
              />
            </Card>

            <Card padded={false}>
              <ListRow
                title="Wallets"
                subtitle={
                  wallets.isLoading
                    ? 'Loading wallets…'
                    : `${walletCount} wallet${walletCount === 1 ? '' : 's'} in this vault`
                }
                leading={<WalletAvatar address="solana-vault" label="SV" size={30} />}
                onPress={() => router.push(routes.wallets as never)}
                testID="home-wallets"
              />
            </Card>
          </Stack>
        </View>

        {/* ── Recent activity ──────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Recent activity"
            subtitle="Most recent records reported by the backend"
            action={
              <Button
                label="See all"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.activity as never)}
              />
            }
          />
          <View style={{ marginTop: spacing.md }}>
            {activity.isLoading ? (
              <SkeletonList count={3} />
            ) : activity.isError ? (
              <ErrorState
                title="Activity unavailable"
                message={errorMessage(activity.error)}
                hasStaleData={recent.length > 0}
                retryable={isRetryable(activity.error)}
                onRetry={() => void activity.refetch()}
              />
            ) : recent.length === 0 ? (
              <EmptyState
                title="No activity yet"
                hint="Records appear here once the backend has synchronised a wallet."
                actionLabel="Open wallets"
                onAction={() => router.push(routes.wallets as never)}
                compact
              />
            ) : (
              <Card padded={false}>
                <Stack gap={spacing.sm}>
                  {recent.map((record) => (
                    <ListRow
                      key={record.id}
                      title={titleCase(record.type)}
                      subtitle={`${titleCase(record.status)}${record.wallet_id ? ` · ${record.wallet_id}` : ''}`}
                      meta={formatRelative(record.created_at)}
                      badges={<StatusBadge status={record.status} size="sm" />}
                      onPress={() => router.push(routes.activityDetail(record.id) as never)}
                    />
                  ))}
                </Stack>
              </Card>
            )}
          </View>
        </View>

        {/* ── Session ──────────────────────────────────────────────── */}
        <Card variant="elevated">
          <Stack gap={spacing.lg}>
            <Row justify="space-between" align="center" gap={spacing.lg}>
              <Text variant="overline" tone="muted">
                Session
              </Text>
              <ConnectionIndicator compact={false} showLastEvent />
            </Row>
            <Row gap={spacing.md} wrap>
              <StatusBadge status="solana mainnet" size="sm" />
              <Button
                label="Refresh"
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={14} color={colors.textSecondary} />}
                onPress={refreshAll}
              />
              <Button
                label="All screens"
                variant="tertiary"
                size="sm"
                onPress={() =>
                  open({
                    title: 'All screens',
                    subtitle: 'Every destination in SOLANA VAULT',
                    maxHeightRatio: 0.9,
                    render: (close) => <AllTabs onNavigate={close} />,
                  })
                }
              />
            </Row>
          </Stack>
        </Card>
      </Stack>
    </PageContainer>
  );
}