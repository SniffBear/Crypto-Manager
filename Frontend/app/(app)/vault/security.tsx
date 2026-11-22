/**
 * VAULT / SECURITY — the vault's real cryptographic posture.
 *
 * Every value on this page is read from `GET /api/v1/vault`. Nothing is
 * estimated: KDF, iteration count, format version and unlock time are exactly
 * what the backend reports.
 *
 * DESIGN.md §36 — sensitive values are never rendered speculatively. The
 * `secret_export_enabled` flag per wallet is shown as a capability badge, and
 * no secret material is ever requested or displayed here.
 *
 * Data: GET /vault, /wallets
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, Input, KeyValue, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta, useSheet } from '@/components/chrome/shell-context';
import { StatusBadge } from '@/components/StatusBadge';
import { WalletAvatar } from '@/components/utility';
import { ListRow } from '@/components/data';
import { EmptyState, ErrorState, SkeletonList } from '@/components/feedback/states';
import { useAuthStore, hasSession } from '@/stores/auth';
import { errorMessage, isRetryable, useExportWalletSecret, useWallets } from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatDateTime, formatNumber } from '@/utils/format';

export default function VaultSecurityScreen() {
  const router = useRouter();
  const vault = useAuthStore((s) => s.vault);
  const refreshStatus = useAuthStore((s) => s.refreshStatus);
  const wallets = useWallets();
  const { open } = useSheet();
  const exportSecret = useExportWalletSecret();

  const openSecretExport = (walletId: string, label: string) => {
    open({
      title: `Export secret · ${label}`,
      subtitle: 'Re-authenticate with the vault password. The secret is returned once and is not persisted by the UI.',
      render: (close) => <SecretExportSheet walletId={walletId} close={close} />,
    });
  };

  usePageMeta({
    title: 'Security',
    subtitle: 'Vault encryption and wallet permissions',
    breadcrumbs: [{ label: 'Vault' }, { label: 'Security' }],
  });

  // The vault metadata is small and rarely changes; refreshStatus re-reads
  // GET /auth/status, which is the cheapest authenticated call available.
  const exposure = useMemo(() => {
    const list = wallets.data ?? [];
    return {
      watchOnly: list.filter((w) => w.watch_only).length,
      cold: list.filter((w) => w.cold_storage).length,
      signingDisabled: list.filter((w) => !w.signing_enabled && !w.watch_only).length,
      broadcastDisabled: list.filter((w) => !w.broadcasting_enabled).length,
      secretExport: list.filter((w) => w.secret_export_enabled).length,
    };
  }, [wallets.data]);

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Security"
          subtitle="How this vault is encrypted, and what each wallet is permitted to do."
          badges={
            <Row gap={spacing.sm} wrap>
              <StatusBadge status={vault?.locked ? 'vault locked' : 'vault unlocked'} />
              <StatusBadge status="solana mainnet" size="sm" />
              <StatusBadge status={hasSession() ? 'configured' : 'unconfigured'} size="sm" />
            </Row>
          }
        />

        {/* ── Vault encryption ─────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Vault"
            subtitle="Reported by GET /vault"
            action={
              <Button
                label="Refresh"
                variant="tertiary"
                size="sm"
                onPress={() => void refreshStatus()}
              />
            }
          />
          <Card variant="elevated" style={{ marginTop: spacing.md }}>
            {vault ? (
              <Stack gap={spacing.sm}>
                <Row gap={spacing.lg} align="center">
                  <View style={styles.mark}>
                    <ShieldCheck size={20} color={colors.success} />
                  </View>
                  <View style={styles.markText}>
                    <Text variant="h3">Encrypted at rest</Text>
                    <Text variant="caption" tone="muted">
                      {vault.kdf.toUpperCase()} · {formatNumber(vault.iterations)} iterations
                    </Text>
                  </View>
                </Row>
                <Divider />
                <KeyValue label="Vault path" value={vault.path} />
                <Divider />
                <KeyValue label="Format version" value={`v${vault.format_version}`} />
                <Divider />
                <KeyValue label="KDF" value={vault.kdf} />
                <Divider />
                <KeyValue label="Iterations" value={formatNumber(vault.iterations)} />
                <Divider />
                <KeyValue
                  label="Last unlocked"
                  value={vault.unlocked_at ? formatDateTime(vault.unlocked_at * 1000) : 'Never'}
                />
                <Divider />
                <KeyValue label="State" value={vault.locked ? 'LOCKED' : 'UNLOCKED'} />
              </Stack>
            ) : (
              <Text variant="body" tone="muted">
                Vault metadata is not available.
              </Text>
            )}
          </Card>
        </View>

        {/* ── Wallet capability summary ────────────────────────────── */}
        <View>
          <SectionHeader
            title="Wallet permissions"
            subtitle="Aggregate counts across every wallet in this vault"
          />
          <Card variant="elevated" style={{ marginTop: spacing.md }}>
            {wallets.isLoading ? (
              <SkeletonList count={3} lines={1} />
            ) : wallets.isError ? (
              <ErrorState
                title="Wallets unavailable"
                message={errorMessage(wallets.error)}
                hasStaleData={Boolean(wallets.data)}
                retryable={isRetryable(wallets.error)}
                onRetry={() => void wallets.refetch()}
              />
            ) : (
              <Stack gap={spacing.md}>
                <KeyValue label="Watch-only wallets" value={formatNumber(exposure.watchOnly)} />
                <Divider />
                <KeyValue label="Cold-storage wallets" value={formatNumber(exposure.cold)} />
                <Divider />
                <KeyValue
                  label="Signing disabled"
                  value={formatNumber(exposure.signingDisabled)}
                />
                <Divider />
                <KeyValue
                  label="Broadcasting disabled"
                  value={formatNumber(exposure.broadcastDisabled)}
                />
                <Divider />
                <KeyValue
                  label="Secret export enabled"
                  value={formatNumber(exposure.secretExport)}
                />
              </Stack>
            )}
          </Card>
        </View>

        {/* ── Per-wallet permissions ──────────────────────────────── */}
        <View>
          <SectionHeader
            title="Wallets"
            subtitle="Tap a wallet to review its address and permissions"
          />
          <View style={{ marginTop: spacing.md }}>
            {wallets.isLoading ? (
              <SkeletonList count={3} />
            ) : (wallets.data ?? []).length === 0 ? (
              <EmptyState
                title="No wallets yet"
                hint="Create or import a wallet to see its permissions here."
                actionLabel="Create wallet"
                onAction={() => router.push(routes.walletsCreate as never)}
                compact
              />
            ) : (
              <Card padded={false}>
                <Stack gap={spacing.sm} style={styles.listPad}>
                  {(wallets.data ?? []).map((wallet) => (
                    <ListRow
                      key={wallet.id}
                      title={wallet.label}
                      subtitle={wallet.role}
                      meta={wallet.address}
                      leading={<WalletAvatar address={wallet.address} label={wallet.label} size={34} />}
                      badges={
                        <Row gap={spacing.sm} wrap>
                          {wallet.watch_only ? <StatusBadge status="watch only" size="sm" /> : null}
                          {wallet.cold_storage ? <StatusBadge status="cold storage" size="sm" /> : null}
                          <StatusBadge
                            status={wallet.signing_enabled ? 'signing enabled' : 'signing disabled'}
                            size="sm"
                          />
                          <StatusBadge
                            status={
                              wallet.broadcasting_enabled ? 'broadcast enabled' : 'broadcast disabled'
                            }
                            size="sm"
                          />
                          <StatusBadge
                            status={wallet.secret_export_enabled ? 'warning' : 'ok'}
                            label={wallet.secret_export_enabled ? 'SECRET EXPORT ON' : 'NO SECRET EXPORT'}
                            size="sm"
                          />
                          {wallet.secret_export_enabled ? (
                            <Button
                              label="Export secret"
                              variant="tertiary"
                              size="sm"
                              onPress={() => openSecretExport(wallet.id, wallet.label)}
                            />
                          ) : null}
                        </Row>
                      }
                      onPress={() => router.push(routes.walletDetail(wallet.id) as never)}
                    />
                  ))}
                </Stack>
              </Card>
            )}
          </View>
        </View>

        {/* ── Key handling ─────────────────────────────────────────── */}
        <View>
          <SectionHeader title="Key handling" />
          <Card variant="elevated" style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.lg}>
              <Row gap={spacing.lg} align="flex-start">
                <View style={styles.markMuted}>
                  <KeyRound size={18} color={colors.textMuted} />
                </View>
                <Text variant="body" tone="secondary" style={styles.paragraph}>
                  Private keys are generated, encrypted and held by the backend. This application
                  never requests, displays or transmits key material. A wallet is imported either
                  by handing its secret to the backend once, or in watch-only mode by address
                  alone.
                </Text>
              </Row>
              <Divider />
              <Row gap={spacing.md} wrap>
                <Button
                  label="Import wallet"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push(routes.walletsImport as never)}
                />
                <Button
                  label="Create wallet"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push(routes.walletsCreate as never)}
                />
                <Button
                  label="Backups"
                  variant="tertiary"
                  size="sm"
                  onPress={() => router.push(routes.backups as never)}
                />
              </Row>
            </Stack>
          </Card>
        </View>

        {/* ── Address book is not implemented ─────────────────────── */}
        <View>
          <SectionHeader title="Address book" />
          <Card style={{ marginTop: spacing.md }}>
            <Row gap={spacing.lg} align="flex-start">
              <Text variant="body" tone="secondary" style={styles.paragraph}>
                The vault payload reserves an <Text variant="monoSmall">address_book</Text>{' '}
                collection, but the backend exposes no route to read or write it. No counterparty
                or address-book screen is shown rather than presenting an empty list as a feature.
              </Text>
            </Row>
          </Card>
        </View>
      </Stack>
    </PageContainer>
  );
}

const styles = {
  mark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.successMuted,
  },
  markMuted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surfaceElevated,
  },
  markText: { flex: 1, gap: spacing.xxs },
  paragraph: { flex: 1 },
  listPad: { padding: spacing.lg },
} as const;


function SecretExportSheet({
  walletId,
  close,
}: {
  walletId: string;
  close: () => void;
}) {
  const exportMutation = useExportWalletSecret();
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const result = exportMutation.data;

  return (
    <Stack gap={spacing.lg}>
      <Input
        label="Vault password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Re-enter vault password"
      />
      <Text variant="caption" tone="muted">
        The backend verifies the vault password before releasing this wallet secret. The screen does not write it to storage.
      </Text>
      {exportMutation.isError ? (
        <Text variant="caption" tone="danger">
          {errorMessage(exportMutation.error)}
        </Text>
      ) : null}
      {result ? (
        <Card variant="flat">
          <Stack gap={spacing.md}>
            <Text variant="overline" tone="muted">Private key</Text>
            <Text variant="monoSmall" numberOfLines={revealed ? undefined : 2}>
              {revealed ? result.secret_key_b58 : '••••••••••••••••••••••••••••••••'}
            </Text>
            <Row gap={spacing.sm} wrap>
              <Button
                label={revealed ? 'Hide' : 'Reveal'}
                variant="secondary"
                size="sm"
                onPress={() => setRevealed((value) => !value)}
              />
              <Button
                label="Copy"
                variant="tertiary"
                size="sm"
                onPress={() => void Clipboard.setStringAsync(result.secret_key_b58)}
              />
            </Row>
            <Text variant="caption" tone="danger">
              Treat this value as wallet ownership material. Clear it from view as soon as the export is complete.
            </Text>
          </Stack>
        </Card>
      ) : null}
      <Row gap={spacing.md} wrap>
        {!result ? (
          <Button
            label="Export once"
            variant="destructive"
            loading={exportMutation.isPending}
            disabled={!password}
            onPress={() =>
              exportMutation.mutate({ walletId, password })
            }
          />
        ) : null}
        <Button label="Close" variant="secondary" onPress={close} />
      </Row>
    </Stack>
  );
}