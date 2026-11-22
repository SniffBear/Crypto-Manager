/**
 * WALLETS / IMPORT — bring an existing Solana keypair under custody.
 *
 * Two genuinely different operations, and the screen keeps them apart rather
 * than presenting one "import" form:
 *
 *   1. SECRET KEY  — the secret is handed to the backend once, over the same
 *      connection as every other request, and is not retained in component
 *      state after the request completes. The field is cleared on success and
 *      on unmount.
 *   2. WATCH ONLY  — an address is registered with no key material at all.
 *
 * DESIGN.md §3.2/§36 — secret-bearing actions require deliberate
 * confirmation and never persist. Nothing here is written to storage, and the
 * input is explicitly non-persistent and not autofillable.
 *
 * Data: POST /wallets/import/secret, /wallets/import/watch-only
 */

import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Chip, Divider, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { NoticeBanner } from '@/components/feedback/states';
import { useConfirmDialog } from '@/components/feedback/confirmation-context';
import { AddressDisplay, WalletAvatar } from '@/components/utility';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/api/client';
import { errorMessage } from '@/hooks/useApi';
import { toast } from '@/stores/toast';
import { useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import type {
  WalletImportSecretRequest,
  WalletImportWatchOnlyRequest,
} from '@/api/types';

type Mode = 'secret' | 'watch';

export default function ImportWalletScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const select = useWalletContext((s) => s.select);
  const { confirm } = useConfirmDialog();

  usePageMeta({
    title: 'Import wallet',
    subtitle: 'Register an existing keypair or a watch-only address',
    breadcrumbs: [{ label: 'Wallets' }, { label: 'Import' }],
  });

  const [mode, setMode] = useState<Mode>('watch');
  const [label, setLabel] = useState('');
  const [group, setGroup] = useState('');
  const [secret, setSecret] = useState('');
  const [address, setAddress] = useState('');
  const [revealed, setRevealed] = useState(false);
  const secretRef = useRef(secret);
  secretRef.current = secret;

  // A secret-bearing screen must not leave the value behind on unmount.
  useEffect(() => {
    return () => {
      setSecret('');
      setRevealed(false);
    };
  }, []);

  const finish = (walletId: string, name: string, walletAddress: string) => {
    void queryClient.invalidateQueries({ queryKey: ['wallets'] });
    void queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
    select(walletId);
    router.replace(routes.walletDetail(walletId) as never);
    toast.success(`${name} imported`, walletAddress);
  };

  const importSecret = useMutation({
    mutationFn: (body: WalletImportSecretRequest) => api.wallets.importSecret(body),
    onSuccess: (wallet) => {
      setSecret('');
      setRevealed(false);
      finish(wallet.id, wallet.label, wallet.address);
    },
  });

  const importWatch = useMutation({
    mutationFn: (body: WalletImportWatchOnlyRequest) => api.wallets.importWatchOnly(body),
    onSuccess: (wallet) => {
      setAddress('');
      finish(wallet.id, wallet.label, wallet.address);
    },
  });

  const trimmedLabel = label.trim();
  const trimmedAddress = address.trim();
  const trimmedSecret = secret.trim();

  const secretValid = trimmedSecret.length > 0;
  const addressValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedAddress);

  const onSubmit = async () => {
    if (!trimmedLabel) return;

    if (mode === 'watch') {
      if (!addressValid) return;
      const ok = await confirm({
        title: `Import ${trimmedLabel} as watch-only?`,
        message: `The backend will register ${trimmedAddress} with no key material. This wallet can observe activity but can never sign or broadcast.`,
        details: ['No private key is sent or stored.', 'Permissions are fixed to watch-only.'],
        confirmLabel: 'Import address',
        tone: 'warning',
      });
      if (!ok) return;
      importWatch.mutate({ address: trimmedAddress, label: trimmedLabel, group: group.trim() || null });
      return;
    }

    if (!secretValid) return;
    const ok = await confirm({
      title: `Import ${trimmedLabel} with its secret key?`,
      message: 'The secret key is sent once so the backend can encrypt it inside the vault, then discarded from this screen.',
      details: [
        'The secret is never written to device storage.',
        'It is cleared from this screen immediately after the request completes.',
        'Anyone who already knows this secret controls the wallet.',
      ],
      confirmLabel: 'Import secret key',
      tone: 'danger',
    });
    if (!ok) return;
    importSecret.mutate({ secret_key: trimmedSecret, label: trimmedLabel, group: group.trim() || null });
  };

  const busy = importSecret.isPending || importWatch.isPending;
  const failure = importSecret.isError ? importSecret.error : importWatch.isError ? importWatch.error : null;
  const canSubmit =
    trimmedLabel.length > 0 && (mode === 'watch' ? addressValid : secretValid) && !busy;

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Import wallet"
          subtitle="Two different operations. Pick the one that matches what you actually hold."
        />

        {/* ── Mode ─────────────────────────────────────────────────── */}
        <View>
          <SectionHeader title="Import mode" />
          <Row gap={spacing.md} wrap style={styles.modeRow}>
            <Chip label="Watch-only address" selected={mode === 'watch'} onPress={() => setMode('watch')} />
            <Chip label="Secret key" selected={mode === 'secret'} onPress={() => setMode('secret')} />
          </Row>
        </View>

        {mode === 'secret' ? (
          <NoticeBanner
            tone="warning"
            title="You are about to hand over a private key"
            message="The secret is transmitted once over the same connection as every other request, encrypted into the vault, and then cleared from this screen. It is never written to this device."
          />
        ) : (
          <NoticeBanner
            tone="info"
            title="No key material is involved"
            message="A watch-only import registers an address so the backend can observe its activity. It can never sign or broadcast."
          />
        )}

        <Card variant="elevated">
          <Stack gap={spacing.xl}>
            <Input
              label="Label"
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Treasury watch"
              autoCapitalize="words"
              maxLength={64}
            />

            <Input
              label="Group"
              value={group}
              onChangeText={setGroup}
              placeholder="Optional"
              autoCapitalize="words"
              maxLength={64}
            />

            {mode === 'watch' ? (
              <Input
                label="Address"
                value={address}
                onChangeText={setAddress}
                placeholder="Base58 Solana address"
                mono
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                textContentType="none"
                hint={
                  address.length > 0 && !addressValid
                    ? 'A Solana address is 32–44 base58 characters.'
                    : undefined
                }
              />
            ) : (
              <Input
                label="Secret key"
                value={secret}
                onChangeText={setSecret}
                placeholder="Base58 secret key"
                mono
                secureTextEntry={!revealed}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                textContentType="none"
                hint="Never stored on this device."
                right={
                  <Button
                    label={revealed ? 'Hide' : 'Show'}
                    variant="ghost"
                    size="sm"
                    icon={
                      revealed ? (
                        <EyeOff size={14} color="#A9B3BE" />
                      ) : (
                        <Eye size={14} color="#A9B3BE" />
                      )
                    }
                    onPress={() => setRevealed((prev) => !prev)}
                  />
                }
              />
            )}

            {failure ? (
              <NoticeBanner
                tone="warning"
                title="The wallet was not imported"
                message={errorMessage(failure)}
              />
            ) : null}

            <Divider />

            <Row justify="space-between" align="center" gap={spacing.lg}>
              <Text variant="caption" tone="muted" style={styles.footnote}>
                {mode === 'watch'
                  ? 'Watch-only wallets appear with the WATCH ONLY badge everywhere.'
                  : 'Imported wallets keep the permissions the backend assigns.'}
              </Text>
              <Button
                label={mode === 'watch' ? 'Import address' : 'Import secret key'}
                variant="primary"
                size="lg"
                loading={busy}
                disabled={!canSubmit}
                onPress={() => void onSubmit()}
              />
            </Row>
          </Stack>
        </Card>

        {importWatch.data ? (
          <Card variant="success">
            <Stack gap={spacing.lg}>
              <Row gap={spacing.lg} align="center">
                <WalletAvatar
                  address={importWatch.data.address}
                  label={importWatch.data.label}
                  size={38}
                />
                <View style={styles.flex}>
                  <Text variant="h3" numberOfLines={1}>
                    {importWatch.data.label}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {importWatch.data.role.replace(/_/g, ' ')}
                  </Text>
                </View>
                <StatusBadge status="watch only" size="sm" />
              </Row>
              <AddressDisplay value={importWatch.data.address} kind="wallet address" size="lg" />
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </PageContainer>
  );
}

const styles = {
  modeRow: { marginTop: spacing.md },
  footnote: { flex: 1 },
  flex: { flex: 1, gap: spacing.xxs },
} as const;