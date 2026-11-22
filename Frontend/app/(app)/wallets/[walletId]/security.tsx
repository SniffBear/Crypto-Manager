/**
 * WALLET / SECURITY — what this single wallet is permitted to do.
 *
 * Every value here comes from `GET /wallets/{id}`. The backend has no
 * per-wallet security endpoint, so this is the wallet's own permission record
 * presented explicitly — no derived risk score, no invented posture.
 *
 * DESIGN.md §36 — no secret material is requested, displayed or hinted at.
 * The `secret_export_enabled` flag is reported as a capability, and the page
 * states plainly that the reveal path is not surfaced here.
 *
 * Data: GET /wallets/{id}
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, KeyValue, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { Tabs } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressDisplay, WalletAvatar } from '@/components/utility';
import {
  EmptyState,
  ErrorState,
  NoticeBanner,
  SkeletonList,
} from '@/components/feedback/states';
import { errorMessage, isRetryable, useWallet } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth';
import { routes, WALLET_DETAIL_TABS, walletDetailTabHref } from '@/navigation/config';
import { formatDateTime, humanize } from '@/utils/format';

export default function WalletSecurityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ walletId: string | string[] }>();
  const walletId = Array.isArray(params.walletId)
    ? (params.walletId[0] ?? null)
    : (params.walletId ?? null);

  const wallet = useWallet(walletId);
  const vault = useAuthStore((s) => s.vault);

  usePageMeta({
    title: 'Security',
    subtitle: wallet.data ? `Permissions for ${wallet.data.label}` : 'Wallet permissions',
    showWalletSelector: true,
    breadcrumbs: [
      { label: 'Wallets', href: routes.wallets },
      {
        label: wallet.data?.label ?? 'Wallet',
        href: walletId ? routes.walletDetail(walletId) : undefined,
      },
      { label: 'Security' },
    ],
  });

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

  const data = wallet.data;

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Security"
          subtitle="Custody, signing and broadcast permissions for this wallet."
          badges={
            data ? (
              <>
                <StatusBadge status={vault?.locked ? 'vault locked' : 'vault unlocked'} />
                {data.watch_only ? <StatusBadge status="watch only" size="sm" /> : null}
                {data.cold_storage ? <StatusBadge status="cold storage" size="sm" /> : null}
              </>
            ) : null
          }
          actions={
            <Button
              label="Vault security"
              variant="tertiary"
              size="sm"
              onPress={() => router.push(routes.vaultSecurity as never)}
            />
          }
        />

        <Tabs
          tabs={WALLET_DETAIL_TABS.map((tab) => ({ ...tab }))}
          active="security"
          onChange={(key) => {
            if (key === 'security') return;
            router.push(walletDetailTabHref(walletId, key) as never);
          }}
        />

        {wallet.isLoading ? (
          <SkeletonList count={4} />
        ) : wallet.isError ? (
          <ErrorState
            title="Wallet unavailable"
            message={errorMessage(wallet.error)}
            hasStaleData={Boolean(wallet.data)}
            retryable={isRetryable(wallet.error)}
            onRetry={() => void wallet.refetch()}
          />
        ) : !data ? (
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
              <Row gap={spacing.lg} align="center">
                <WalletAvatar address={data.address} label={data.label} size={40} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text variant="h3" numberOfLines={1}>
                    {data.label}
                  </Text>
                  <AddressDisplay value={data.address} kind="wallet address" />
                </View>
              </Row>
            </Card>

            {/* ── Permissions ──────────────────────────────────────── */}
            <View>
              <SectionHeader
                title="Permissions"
                subtitle="Reported verbatim by the backend"
              />
              <Card variant="elevated" style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.xs}>
                  <Permission
                    label="Watch only"
                    granted={data.watch_only}
                    on="The vault holds the address but no key — it cannot sign."
                    off="The vault holds the key for this address."
                  />
                  <Divider />
                  <Permission
                    label="Cold storage"
                    granted={data.cold_storage}
                    on="Held for long-term storage and not part of routine operation."
                    off="Available for routine use."
                  />
                  <Divider />
                  <Permission
                    label="Signing"
                    granted={data.signing_enabled}
                    on="This wallet may sign transactions."
                    off="This wallet may not sign transactions."
                  />
                  <Divider />
                  <Permission
                    label="Broadcasting"
                    granted={data.broadcasting_enabled}
                    on="This wallet may submit transactions to the network."
                    off="This wallet may not submit transactions to the network."
                  />
                  <Divider />
                  <Permission
                    label="Secret export"
                    granted={data.secret_export_enabled}
                    on="The backend permits this wallet's key to be revealed."
                    off="The backend will not reveal this wallet's key."
                  />
                </Stack>
              </Card>
            </View>

            {/* ── Record ───────────────────────────────────────────── */}
            <View>
              <SectionHeader title="Record" />
              <Card variant="elevated" style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.sm}>
                  <KeyValue label="Wallet id" value={data.id} />
                  <Divider />
                  <KeyValue label="Role" value={humanize(data.role)} />
                  <Divider />
                  <KeyValue
                    label="Group"
                    value={data.group?.trim() ? data.group : 'Ungrouped'}
                  />
                  <Divider />
                  <KeyValue label="Created" value={formatDateTime(data.created_at)} />
                  <Divider />
                  <KeyValue
                    label="Tags"
                    value={data.tags.length > 0 ? data.tags.join(' · ') : 'None'}
                  />
                </Stack>
              </Card>
            </View>

            {/* ── Explicit limits ──────────────────────────────────── */}
            {data.secret_export_enabled ? (
              <NoticeBanner
                tone="warning"
                title="Secret export is enabled for this wallet"
                message="The backend permits this key to be revealed. No reveal or export action is offered here — key material is never requested by this application, and the vault-wide Security screen remains the place to review this flag across every wallet."
              />
            ) : null}

            <NoticeBanner
              tone="neutral"
              title="No per-wallet security endpoint"
              message="The backend exposes no route that scores, audits or reports on a single wallet. Everything above is the wallet's own permission record from GET /wallets/{id}; no posture is computed and nothing is inferred."
            />

            <Row gap={spacing.md} wrap>
              <Button
                label="Vault security"
                variant="secondary"
                size="sm"
                onPress={() => router.push(routes.vaultSecurity as never)}
              />
              <Button
                label="Backups"
                variant="secondary"
                size="sm"
                onPress={() => router.push(routes.backups as never)}
              />
              <Button
                label="Risk monitor"
                variant="tertiary"
                size="sm"
                onPress={() => router.push(routes.risk as never)}
              />
            </Row>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}

function Permission({
  label,
  granted,
  on,
  off,
}: {
  label: string;
  granted: boolean;
  on: string;
  off: string;
}) {
  return (
    <Row justify="space-between" align="center" gap={spacing.lg}>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="muted">
          {granted ? on : off}
        </Text>
      </View>
      <StatusBadge status={granted ? 'granted' : 'denied'} size="sm" />
    </Row>
  );
}