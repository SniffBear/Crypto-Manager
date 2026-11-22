/**
 * Vault unlock.
 *
 * DESIGN.md §3.1 — unlocking is the gate for every authenticated screen. The
 * screen shows the vault's real metadata (path, format version, KDF) so the
 * user can see what they are unlocking, and it never claims to remember the
 * password: DESIGN.md §36 forbids persisting it.
 *
 * Backend: POST /api/v1/auth/unlock
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyRound } from 'lucide-react-native';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, Input, Row, Stack } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { NoticeBanner } from '@/components/feedback/states';
import { useAuthStore } from '@/stores/auth';
import { useConstrainedLayout } from '@/hooks/useResponsive';
import { formatDateTime } from '@/utils/format';

export default function UnlockScreen() {
  const insets = useSafeAreaInsets();
  const constrained = useConstrainedLayout();

  const unlock = useAuthStore((s) => s.unlock);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const vault = useAuthStore((s) => s.vault);

  const [password, setPassword] = useState('');

  const onSubmit = () => {
    if (!password || busy) return;
    void unlock(password).then((ok) => {
      if (ok) setPassword('');
    });
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.huge },
      ]}
    >
      <View style={[styles.column, constrained ? styles.columnWide : null]}>
        <Stack gap={spacing.xxl}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <KeyRound size={22} color={colors.accent} />
            </View>
            <Text variant="overline" tone="accent">
              SOLANA VAULT
            </Text>
            <Text variant="h1">Vault locked</Text>
            <Text variant="body" tone="secondary">
              Enter the master password to decrypt the vault. Nothing is cached while the
              vault is locked.
            </Text>
          </View>

          {vault?.exists ? (
            <Card variant="elevated">
              <Stack gap={spacing.lg}>
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="overline" tone="muted">
                    Vault file
                  </Text>
                  <StatusBadge status="vault locked" />
                </Row>
                <Divider />
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="caption" tone="muted">
                    Path
                  </Text>
                  <Text variant="monoSmall" tone="secondary" numberOfLines={1} style={styles.value}>
                    {vault.path}
                  </Text>
                </Row>
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="caption" tone="muted">
                    Format
                  </Text>
                  <Text variant="monoSmall" tone="secondary">
                    v{vault.format_version}
                  </Text>
                </Row>
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="caption" tone="muted">
                    KDF
                  </Text>
                  <Text variant="monoSmall" tone="secondary">
                    {vault.kdf} · {vault.iterations.toLocaleString()} iterations
                  </Text>
                </Row>
                {vault.unlocked_at ? (
                  <Row justify="space-between" align="center" gap={spacing.lg}>
                    <Text variant="caption" tone="muted">
                      Last unlocked
                    </Text>
                    <Text variant="monoSmall" tone="secondary">
                      {formatDateTime(vault.unlocked_at * 1000)}
                    </Text>
                  </Row>
                ) : null}
              </Stack>
            </Card>
          ) : null}

          <Card variant="elevated">
            <Stack gap={spacing.xl}>
              <Input
                label="Master password"
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  if (error) clearError();
                }}
                placeholder="Enter your master password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                accessibilityLabel="Master password"
              />

              {error ? <NoticeBanner tone="warning" title={error} /> : null}

              <Button
                label="Unlock vault"
                variant="primary"
                size="lg"
                fullWidth
                loading={busy}
                disabled={!password}
                onPress={onSubmit}
              />

              <Text variant="caption" tone="muted" align="center">
                The password is held in memory only for the duration of the request and is never
                saved to this device.
              </Text>
            </Stack>
          </Card>
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  column: { width: '100%', maxWidth: 520 },
  columnWide: { maxWidth: 600 },
  brand: { gap: spacing.md },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  value: { flexShrink: 1, maxWidth: '60%', textAlign: 'right' },
});