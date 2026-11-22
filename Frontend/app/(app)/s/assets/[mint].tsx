/**
 * ASSET DETAIL — one token, in full.
 *
 * Every field is read from `GET /assets/{mint}`. The token hierarchy the
 * mockups showed (a tree of mints, owners and related programs) is not
 * available: the backend has no endpoint for token relationships, holders or
 * owner programmes, so this page is a flat, complete record instead of a
 * fabricated hierarchy.
 *
 * Data: GET /assets/{mint}, /wallets
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, KeyValue, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { MetricCard, ListRow } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressDisplay, TokenIcon, WalletAvatar } from '@/components/utility';
import {
  EmptyState,
  ErrorState,
  NoticeBanner,
  SkeletonList,
} from '@/components/feedback/states';
import { errorMessage, isRetryable, useAsset, useWallets } from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatDateTime, formatNumber, formatUsd, titleCase } from '@/utils/format';

export default function AssetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mint: string | string[] }>();
  const raw = Array.isArray(params.mint) ? params.mint[0] : params.mint;
  const mint = raw?.trim() ? decodeURIComponent(raw) : null;

  const asset = useAsset(mint);
  const wallets = useWallets();

  const data = asset.data;

  const holders = useMemo(() => {
    const ids = data?.wallet_ids ?? [];
    return (wallets.data ?? []).filter((wallet) => ids.includes(wallet.id));
  }, [data?.wallet_ids, wallets.data]);

  usePageMeta({
    title: data?.symbol ?? 'Asset',
    subtitle: data?.name ?? 'Token detail',
    breadcrumbs: [
      { label: 'Assets', href: routes.assets },
      { label: data?.symbol ?? 'Token' },
    ],
  });

  if (!mint) {
    return (
      <PageContainer>
        <EmptyState
          title="No token requested"
          hint="This screen needs a mint address. Open the asset list to choose one."
          actionLabel="Open assets"
          onAction={() => router.replace(routes.assets as never)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title={data?.symbol ?? 'Asset'}
          subtitle={data?.name ?? 'Loading token…'}
          detail={mint}
          badges={
            data ? (
              <>
                <StatusBadge status={data.risk ?? 'unknown'} />
                <StatusBadge status="solana mainnet" size="sm" />
              </>
            ) : null
          }
          actions={
            <Button
              label="All assets"
              variant="tertiary"
              size="sm"
              onPress={() => router.push(routes.assets as never)}
            />
          }
        />

        {asset.isLoading ? (
          <SkeletonList count={4} />
        ) : asset.isError ? (
          <ErrorState
            title="Token unavailable"
            message={errorMessage(asset.error)}
            retryable={isRetryable(asset.error)}
            onRetry={() => void asset.refetch()}
          />
        ) : !data ? (
          <EmptyState
            title="Token not found"
            hint="The backend holds no record for this mint. It may never have been held in this vault."
            actionLabel="Open assets"
            onAction={() => router.replace(routes.assets as never)}
          />
        ) : (
          <>
            {/* ── Headline ─────────────────────────────────────────── */}
            <Card variant="elevated">
              <Row gap={spacing.xl} align="center">
                <TokenIcon mint={data.mint} symbol={data.symbol} size={48} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text variant="h3" numberOfLines={1}>
                    {data.symbol ?? 'Unnamed token'}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {data.name ?? 'No name reported'}
                  </Text>
                </View>
              </Row>
            </Card>

            <MetricCard
              label="Value"
              value={formatUsd(data.value_usd)}
              sublabel={
                data.price_usd !== undefined
                  ? `Price ${formatUsd(data.price_usd, { decimals: 6 })} per token`
                  : 'The backend reported no unit price for this token'
              }
              testID="asset-value"
            />

            {/* ── Identity ─────────────────────────────────────────── */}
            <View>
              <SectionHeader title="Identity" subtitle="Exactly what the backend reports" />
              <Card style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.sm}>
                  <KeyValue
                    label="Mint"
                    value={<AddressDisplay value={data.mint} kind="mint" />}
                  />
                  <Divider />
                  <KeyValue
                    label="Token account"
                    value={
                      data.token_account ? (
                        <AddressDisplay
                          value={data.token_account}
                          kind="token account"
                          size="sm"
                        />
                      ) : (
                        'Not reported'
                      )
                    }
                  />
                  <Divider />
                  <KeyValue
                    label="Program"
                    value={
                      data.program ? (
                        <AddressDisplay value={data.program} kind="program" size="sm" />
                      ) : (
                        'Not reported'
                      )
                    }
                  />
                  <Divider />
                  <KeyValue
                    label="Decimals"
                    value={data.decimals !== undefined ? formatNumber(data.decimals) : 'Not reported'}
                  />
                  <Divider />
                  <KeyValue label="Risk" value={titleCase(data.risk) } />
                  <Divider />
                  <KeyValue label="Last updated" value={formatDateTime(data.updated_at)} />
                </Stack>
              </Card>
            </View>

            {/* ── Wallets holding it ──────────────────────────────── */}
            <View>
              <SectionHeader
                title="Held by"
                subtitle="Wallets the backend attributes this token to"
              />
              <Card padded={false} style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.sm} style={styles.listPad}>
                  {(data.wallet_ids ?? []).length === 0 ? (
                    <Text variant="body" tone="muted" style={styles.listPad}>
                      No wallet is attributed to this token.
                    </Text>
                  ) : wallets.isLoading ? (
                    <SkeletonList count={2} />
                  ) : (
                    (data.wallet_ids ?? []).map((id) => {
                      const wallet = holders.find((w) => w.id === id);
                      return (
                        <ListRow
                          key={id}
                          title={wallet?.label ?? id}
                          subtitle={wallet ? titleCase(wallet.role) : 'Wallet not in this vault'}
                          meta={wallet?.address}
                          leading={
                            <WalletAvatar
                              address={wallet?.address ?? id}
                              label={wallet?.label ?? '?'}
                              size={32}
                            />
                          }
                          onPress={
                            wallet
                              ? () => router.push(routes.walletDetail(wallet.id) as never)
                              : undefined
                          }
                        />
                      );
                    })
                  )}
                </Stack>
              </Card>
            </View>

            <NoticeBanner
              tone="neutral"
              title="No token hierarchy, owner or holder data"
              message="The mockups presented a token tree with related programmes, owner addresses and holder breakdowns. The backend implements no endpoint for token relationships, holders or owner programmes, and no price history. What is shown here is the complete record the API holds for this mint."
            />

            <Row gap={spacing.md} wrap>
              <Button
                label="Risk monitor"
                variant="secondary"
                size="sm"
                onPress={() => router.push(routes.risk as never)}
              />
              <Button
                label="Watchlists"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.watchlists as never)}
              />
            </Row>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}

const styles = {
  listPad: { padding: spacing.lg },
} as const;