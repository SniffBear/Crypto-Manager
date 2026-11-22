/**
 * RECEIVE — inbound address for one wallet.
 *
 * `GET /receive/{wallet_id}` returns the address, the label and the watch-only
 * flag. That is the whole capability, so this screen shows the address with a
 * copy action, states plainly what it can and cannot do, and requires a wallet
 * to be selected first — DESIGN.md §12 says the selection is global, so
 * choosing a wallet here changes it everywhere rather than opening a
 * per-screen picker.
 *
 * Data: GET /receive/{wallet_id}, /wallets
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, KeyValue, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { ListRow } from '@/components/data';
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
  useReceiveInfo,
  useWallets,
} from '@/hooks/useApi';
import { ALL_WALLETS, useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import { formatDateTime, humanize } from '@/utils/format';

export default function ReceiveScreen() {
  const router = useRouter();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const select = useWalletContext((s) => s.select);
  const selectAll = useWalletContext((s) => s.selectAll);

  usePageMeta({
    title: 'Receive',
    subtitle:
      selectedWalletId === ALL_WALLETS
        ? 'Choose a wallet to get an address'
        : 'Inbound address for the selected wallet',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Receive' }],
  });

  const wallets = useWallets();
  const info = useReceiveInfo(selectedWalletId);

  const selected = useMemo(
    () => (wallets.data ?? []).find((w) => w.id === selectedWalletId) ?? null,
    [wallets.data, selectedWalletId],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Receive"
          subtitle="Share an address to be paid. Nothing here moves funds."
          badges={
            info.data ? (
              <StatusBadge status={info.data.watch_only ? 'watch only' : 'signing enabled'} />
            ) : null
          }
        />

        {selectedWalletId === ALL_WALLETS ? (
          <>
            <NoticeBanner
              tone="info"
              title="Pick a wallet first"
              message="An address belongs to a wallet. Choosing one here also scopes the rest of the app to it, which is the single global wallet context rather than a per-screen picker."
            />
            {wallets.isLoading ? (
              <SkeletonList count={4} />
            ) : (wallets.data ?? []).length === 0 ? (
              <EmptyState
                title="No wallets yet"
                hint="Create or import a wallet to receive funds."
                actionLabel="Create wallet"
                onAction={() => router.push(routes.walletsCreate as never)}
              />
            ) : (
              <Card padded={false}>
                <Stack gap={spacing.sm} style={styles.listPad}>
                  {(wallets.data ?? []).map((wallet) => (
                    <ListRow
                      key={wallet.id}
                      title={wallet.label}
                      subtitle={`${humanize(wallet.role)}${wallet.group ? ` · ${wallet.group}` : ''}`}
                      meta={wallet.address}
                      leading={
                        <WalletAvatar address={wallet.address} label={wallet.label} size={34} />
                      }
                      onPress={() => select(wallet.id)}
                    />
                  ))}
                </Stack>
              </Card>
            )}
          </>
        ) : info.isLoading ? (
          <SkeletonList count={3} />
        ) : info.isError ? (
          <ErrorState
            title="Receive details unavailable"
            message={errorMessage(info.error)}
            hasStaleData={Boolean(info.data)}
            retryable={isRetryable(info.error)}
            onRetry={() => void info.refetch()}
            secondaryLabel="Pick another wallet"
            onSecondary={() => selectAll}
          />
        ) : !info.data ? (
          <EmptyState
            title="No receive details"
            hint="The backend returned nothing for this wallet."
            actionLabel="Pick another wallet"
            onAction={() => selectAll}
          />
        ) : (
          <>
            {/* ── Address ───────────────────────────────────────────── */}
            <Card variant="elevated">
              <Stack gap={spacing.lg}>
                <Row gap={spacing.lg} align="center">
                  <WalletAvatar
                    address={info.data.address}
                    label={info.data.label}
                    size={40}
                  />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text variant="h3" numberOfLines={1}>
                      {info.data.label}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {selected ? humanize(selected.role) : 'Selected wallet'}
                    </Text>
                  </View>
                </Row>
                <Divider />
                <AddressDisplay value={info.data.address} kind="receive address" size="lg" />
              </Stack>
            </Card>

            {/* ── Detail ────────────────────────────────────────────── */}
            <View>
              <SectionHeader title="Detail" subtitle="Reported by GET /receive/{id}" />
              <Card style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.sm}>
                  <KeyValue label="Address" value={info.data.address} />
                  <Divider />
                  <KeyValue label="Label" value={info.data.label} />
                  <Divider />
                  <KeyValue
                    label="Watch only"
                    value={info.data.watch_only ? 'YES' : 'NO'}
                  />
                  {selected ? (
                    <>
                      <Divider />
                      <KeyValue label="Wallet created" value={formatDateTime(selected.created_at)} />
                      <Divider />
                      <KeyValue label="Cold storage" value={selected.cold_storage ? 'YES' : 'NO'} />
                    </>
                  ) : null}
                </Stack>
              </Card>
            </View>

            <Row gap={spacing.md} wrap>
              <Button
                label="Open wallet"
                variant="secondary"
                size="sm"
                onPress={() => router.push(routes.walletDetail(info.data.wallet_id) as never)}
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

        <NoticeBanner
          tone="warning"
          title="Verify the address before sharing it"
          message="Sending to a wrong or substituted address is unrecoverable on Solana. Compare the full value, not the shortened form — this app never asks you to trust a truncated address."
        />

        <NoticeBanner
          tone="neutral"
          title="No address book, no request tracking"
          message="The backend exposes no address-book route, and no endpoint that lists expected or pending inbound transfers. The alert center reports what the backend notices, but it does not track a payment you are waiting for."
        />
      </Stack>
    </PageContainer>
  );
}

const styles = {
  listPad: { padding: spacing.lg },
} as const;