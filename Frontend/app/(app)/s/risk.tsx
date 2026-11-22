/**
 * RISK MONITOR — asset risk across the vault.
 *
 * `GET /risk/overview` returns exactly two things: the count of assets, and
 * four buckets. That is the whole backend surface, so this screen leads with
 * the buckets and then lists the assets whose own `risk` field puts them in
 * the high and medium buckets — a derivation of data already in hand, not a
 * second opinion.
 *
 * The mockup's "threat vector investigation" workspace — a per-vector risk
 * score, a threat timeline, a severity ranking — has no endpoint behind it and
 * is not approximated here (DESIGN.md §1).
 *
 * Data: GET /risk/overview, /assets
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { ListRow, MetricCard } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { RISK_TONE } from '@/design/status';
import { TokenIcon } from '@/components/utility';
import {
  EmptyState,
  ErrorState,
  NoticeBanner,
  SkeletonList,
} from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useRiskOverview,
  useScopedAssets,
  type Asset,
} from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatRatio, formatUsd, shortenMint } from '@/utils/format';

const HIGH_RISK = ['high', 'critical', 'severe'];
const MEDIUM_RISK = ['medium', 'moderate', 'elevated'];

type BucketTone = 'danger' | 'warning' | 'success' | 'neutral';

export default function RiskScreen() {
  const router = useRouter();

  usePageMeta({
    title: 'Risk monitor',
    subtitle: 'Asset risk as the backend classifies it',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Risk monitor' }],
  });

  const risk = useRiskOverview();
  const assets = useScopedAssets();

  const buckets = risk.data?.asset_risk_buckets;
  const total = risk.data?.asset_count ?? 0;

  // Derived from the assets' own `risk` field — the same field the buckets
  // are computed from, listed rather than summarised.
  const ranked = useMemo(() => {
    const list = assets.data ?? [];
    return {
      high: list.filter((a) => HIGH_RISK.includes((a.risk ?? '').toLowerCase())),
      medium: list.filter((a) => MEDIUM_RISK.includes((a.risk ?? '').toLowerCase())),
    };
  }, [assets.data]);

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Risk monitor"
          subtitle="How the backend classifies the assets in this vault."
          badges={
            buckets ? (
              <StatusBadge
                status={buckets.high > 0 ? 'degraded' : 'healthy'}
                label={buckets.high > 0 ? `${buckets.high} HIGH RISK` : 'NO HIGH-RISK ASSETS'}
              />
            ) : null
          }
        />

        {/* ── Headline ────────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Overview"
            subtitle="GET /risk/overview reports counts only"
          />
          <View style={{ marginTop: spacing.md }}>
            {risk.isLoading ? (
              <Card>
                <Stack gap={spacing.lg}>
                  <Text variant="overline" tone="muted">
                    Assets assessed
                  </Text>
                  <SkeletonList count={1} lines={1} />
                </Stack>
              </Card>
            ) : risk.isError ? (
              <ErrorState
                title="Risk overview unavailable"
                message={errorMessage(risk.error)}
                hasStaleData={Boolean(risk.data)}
                retryable={isRetryable(risk.error)}
                onRetry={() => void risk.refetch()}
              />
            ) : (
              <MetricCard
                label="Assets assessed"
                value={String(total)}
                sublabel={
                  buckets
                    ? `${buckets.high} high · ${buckets.medium} medium · ${buckets.low} low · ${buckets.unknown} unknown`
                    : undefined
                }
                testID="risk-asset-count"
              />
            )}
          </View>
        </View>

        {/* ── Buckets ─────────────────────────────────────────────── */}
        {buckets ? (
          <View>
            <SectionHeader title="Buckets" subtitle="Share of the assessed assets" />
            <Card variant="elevated" style={{ marginTop: spacing.md }}>
              <Stack gap={spacing.lg}>
                <BucketRow label="High" count={buckets.high} total={total} tone="danger" />
                <BucketRow label="Medium" count={buckets.medium} total={total} tone="warning" />
                <BucketRow label="Low" count={buckets.low} total={total} tone="success" />
                <BucketRow label="Unknown" count={buckets.unknown} total={total} tone="neutral" />
              </Stack>
            </Card>
          </View>
        ) : null}

        {/* ── High-risk assets ────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="High-risk assets"
            subtitle="Assets whose own risk field places them in the high buckets"
            action={
              <Button
                label="All assets"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.assets as never)}
              />
            }
          />
          <View style={{ marginTop: spacing.md }}>
            {assets.isLoading ? (
              <SkeletonList count={3} />
            ) : ranked.high.length === 0 ? (
              <EmptyState
                title="No high-risk assets"
                hint={
                  buckets && buckets.high > 0
                    ? 'The overview counts high-risk assets, but none of them are in the current wallet scope. Clear the wallet context to see the full set.'
                    : 'Nothing in this vault is classified as high risk.'
                }
                compact
              />
            ) : (
              <Card padded={false}>
                <Stack gap={spacing.sm} style={styles.listPad}>
                  {ranked.high.map((asset) => (
                    <AssetRiskRow
                      key={asset.mint}
                      asset={asset}
                      onPress={() => router.push(routes.assetDetail(asset.mint) as never)}
                    />
                  ))}
                </Stack>
              </Card>
            )}
          </View>
        </View>

        {/* ── Medium-risk assets ──────────────────────────────────── */}
        {ranked.medium.length > 0 ? (
          <View>
            <SectionHeader
              title="Medium-risk assets"
              subtitle="Worth reviewing before any transfer out"
            />
            <Card padded={false} style={{ marginTop: spacing.md }}>
              <Stack gap={spacing.sm} style={styles.listPad}>
                {ranked.medium.map((asset) => (
                  <AssetRiskRow
                    key={asset.mint}
                    asset={asset}
                    onPress={() => router.push(routes.assetDetail(asset.mint) as never)}
                  />
                ))}
              </Stack>
            </Card>
          </View>
        ) : null}

        {/* ── What is not here ────────────────────────────────────── */}
        <View>
          <SectionHeader title="Not available" />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.sm}>
              <Text variant="body" tone="secondary">
                The backend reports asset risk as a classification on each token and as four
                aggregate counts. It exposes no risk score, no vector breakdown, no severity
                ranking, no exposure limit and no historical trend.
              </Text>
              <Text variant="caption" tone="muted">
                The threat-vector investigation workspace in the mockups has nothing behind it, so
                no score is invented to fill it.
              </Text>
            </Stack>
          </Card>
        </View>

        <NoticeBanner
          tone="neutral"
          title="Scoped to the selected wallet"
          message="The asset lists above follow the wallet context in the App Bar. The bucket counts come from the vault-wide overview and are not filtered, because the endpoint takes no wallet parameter."
        />
      </Stack>
    </PageContainer>
  );
}

function BucketRow({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: BucketTone;
}) {
  const share = total ? Math.min(100, (count / total) * 100) : 0;
  return (
    <Stack gap={spacing.sm}>
      <Row justify="space-between" align="center" gap={spacing.md}>
        <Text variant="body">{label}</Text>
        <Text variant="monoSmall" tone="secondary">
          {count} · {formatRatio(count, total)}
        </Text>
      </Row>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share}%`, backgroundColor: BUCKET_COLOR[tone] }]} />
      </View>
    </Stack>
  );
}

function AssetRiskRow({ asset, onPress }: { asset: Asset; onPress: () => void }) {
  const holders = asset.wallet_ids?.length ?? 0;
  return (
    <ListRow
      title={asset.symbol ?? shortenMint(asset.mint)}
      subtitle={
        holders > 0
          ? `${asset.name ?? 'Unnamed token'} · held by ${holders} wallet${holders === 1 ? '' : 's'}`
          : (asset.name ?? 'Unnamed token')
      }
      meta={shortenMint(asset.mint)}
      leading={<TokenIcon mint={asset.mint} symbol={asset.symbol} size={32} />}
      badges={
        <StatusBadge
          status={asset.risk ?? 'unknown'}
          size="sm"
          tone={RISK_TONE[asset.risk ?? 'unknown']}
        />
      }
      trailing={
        <Text variant="monoSmall" tone="secondary">
          {formatUsd(asset.value_usd)}
        </Text>
      }
      onPress={onPress}
    />
  );
}

const BUCKET_COLOR: Record<BucketTone, string> = {
  danger: colors.danger,
  warning: colors.warning,
  success: colors.success,
  neutral: colors.textMuted,
};

const styles = {
  listPad: { padding: spacing.lg },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHover,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radii.pill },
} as const;