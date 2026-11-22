/**
 * Vault setup — first run.
 *
 * DESIGN.md §3.1/§36 — creating the vault is the moment the master password is
 * set. The screen states the real consequences of that choice (the password
 * is never recoverable, the KDF parameters come from the backend and are
 * shown rather than implied) and requires the password to be typed twice.
 *
 * Backend: POST /api/v1/auth/setup
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, Input, Row, Stack } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { NoticeBanner } from '@/components/feedback/states';
import { useAuthStore } from '@/stores/auth';
import { useConstrainedLayout } from '@/hooks/useResponsive';

const MIN_PASSWORD_LENGTH = 8;

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const constrained = useConstrainedLayout();

  const setup = useAuthStore((s) => s.setup);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && confirm === password && !busy;

  const onSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    void setup(password).then((ok) => {
      // The token is already in memory; the gate routes onward.
      if (ok) {
        setPassword('');
        setConfirm('');
      }
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.huge }]}>
      <View style={[styles.column, constrained ? styles.columnWide : null]}>
        <Stack gap={spacing.xxl}>
          <View style={styles.brand}>
            <Text variant="overline" tone="accent">
              SOLANA VAULT
            </Text>
            <Text variant="h1">Create your vault</Text>
            <Text variant="body" tone="secondary">
              The vault is encrypted on this machine. Everything the app shows — wallets,
              balances, activity, alerts — lives inside it.
            </Text>
          </View>

          <NoticeBanner
            tone="warning"
            title="The master password cannot be recovered"
            message="It is never stored, logged or transmitted. If it is lost, the vault cannot be opened and its contents cannot be recovered by this application."
          />

          <Card variant="elevated">
            <Stack gap={spacing.xl}>
              <Input
                label="Master password"
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  if (error) clearError();
                }}
                placeholder="At least 8 characters"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                onSubmitEditing={onSubmit}
                error={touched && tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
                hint={`${password.length} characters`}
              />

              <Input
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat the password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                onSubmitEditing={onSubmit}
                error={touched && mismatch ? 'The two passwords do not match.' : undefined}
              />

              {error ? <NoticeBanner tone="warning" title={error} /> : null}

              <Divider />

              <Row justify="space-between" align="center" gap={spacing.lg}>
                <Text variant="caption" tone="muted" style={styles.hint}>
                  Encryption parameters are chosen by the backend and shown on the Security page
                  once the vault exists.
                </Text>
                <Button
                  label="Create vault"
                  variant="primary"
                  size="lg"
                  loading={busy}
                  disabled={!canSubmit}
                  onPress={onSubmit}
                />
              </Row>
            </Stack>
          </Card>

          <Row justify="center" gap={spacing.sm}>
            <StatusBadge status="unconfigured" size="sm" />
            <Text variant="caption" tone="muted">
              Solana mainnet only
            </Text>
          </Row>
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
  column: { width: '100%', maxWidth: 560 },
  columnWide: { maxWidth: 640 },
  brand: { gap: spacing.md },
  hint: { flex: 1 },
});