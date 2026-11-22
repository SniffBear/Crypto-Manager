/**
 * WALLETS / GROUPS — organisation labels.
 *
 * `group` is a free-text field the backend stores on each wallet. There is no
 * group resource, no group CRUD route and no group hierarchy, so this screen
 * reports the groups that actually exist and explicitly says what is not
 * available rather than offering group editing that would 404.
 *
 * Data: GET /wallets
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { ListRow } from '@/components/data';
import { WalletAvatar } from '@/components/utility';
import { EmptyState, ErrorState, NoticeBanner, SkeletonList } from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  usePortfolioSummary,
  useWallets,
  type Wallet,
} from '@/hooks/useApi';
import { useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import { formatUsd } from '@/utils/format';

const UNGROUPED = 'Ungrouped';

export default function WalletGroupsScreen() {
  const router = useRouter();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const select = useWalletContext((s) => s.select);

  usePageMeta({
    title: 'Groups',
    subtitle: 'Labels used to organise wallets',
    breadcrumbs: [{ label: 'Wallets' }, { label: 'Groups' }],
  });

  const wallets = useWallets();
  const summary = usePortfolioSummary();

  const groups = useMemo(() => {
    const map = new Map<string, Wallet[]>();
    for (const wallet of wallets.data ?? []) {
      const key = wallet.group?.trim() || UNGROUPED;
      const bucket = map.get(key);
      if (bucket) bucket.push(wallet);
      else map.set(key, [wallet]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [wallets.data]);

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Groups"
          subtitle="How the wallets in this vault are labelled."
          actions={
            <Button
              label="All wallets"
              variant="secondary"
              size="sm"
              onPress={() => router.push(routes.wallets as never)}
            />
          }
        />

        <NoticeBanner
          tone="neutral"
          title="Groups are labels, not a resource"
          message="The backend stores a free-text group on each wallet. There is no group endpoint, so groups cannot be created, renamed or deleted from here — they follow the wallet's own label."
        />

        {wallets.isLoading ? (
          <SkeletonList count={3} />
        ) : wallets.isError ? (
          <ErrorState
            title="Wallets unavailable"
            message={errorMessage(wallets.error)}
            retryable={isRetryable(wallets.error)}
            onRetry={() => void wallets.refetch()}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No wallets yet"
            hint="Create or import a wallet to see it grouped here."
            actionLabel="Create wallet"
            onAction={() => router.push(routes.walletsCreate as never)}
          />
        ) : (
          groups.map(([name, members]) => {
            const total = members.reduce(
              (sum, wallet) => sum + (summary.data?.wallet_values_usd?.[wallet.id] ?? 0),
              0,
            );
            return (
              <View key={name}>
                <Row justify="space-between" align="center" gap={spacing.lg} style={styles.groupHead}>
                  <Text variant="overline" tone="muted" numberOfLines={1} style={styles.flex}>
                    {name}
                  </Text>
                  <Text variant="monoSmall" tone="secondary">
                    {members.length} · {formatUsd(total)}
                  </Text>
                </Row>
                <Card padded={false}>
                  <Stack gap={spacing.sm} style={styles.listPad}>
                    {members.map((wallet) => (
                      <ListRow
                        key={wallet.id}
                        title={wallet.label}
                        subtitle={wallet.role.replace(/_/g, ' ')}
                        meta={wallet.address}
                        selected={wallet.id === selectedWalletId}
                        leading={
                          <WalletAvatar address={wallet.address} label={wallet.label} size={32} />
                        }
                        trailing={
                          <Text variant="monoSmall" tone="secondary">
                            {formatUsd(summary.data?.wallet_values_usd?.[wallet.id] ?? 0)}
                          </Text>
                        }
                        onPress={() => {
                          select(wallet.id);
                          router.push(routes.walletDetail(wallet.id) as never);
                        }}
                      />
                    ))}
                  </Stack>
                </Card>
              </View>
            );
          })
        )}
      </Stack>
    </PageContainer>
  );
}

const styles = {
  groupHead: { marginBottom: spacing.md },
  listPad: { padding: spacing.lg },
  flex: { flex: 1 },
} as const;