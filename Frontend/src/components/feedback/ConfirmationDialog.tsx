/**
 * ConfirmationDialog.
 *
 * DESIGN.md §3.2 — anything involving secrets, signing, broadcasting,
 * key export, backup/restore, destructive actions or credential changes
 * requires deliberate confirmation. This is the one component used for all
 * of them, so the confirmation language never varies by screen.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertTriangle, ShieldAlert } from 'lucide-react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { Button, Input, Row, Stack } from '@/components/primitives';
import { Text } from '@/components/primitives/Text';
import { Modal } from './Modal';

export type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  /** What will happen, in plain language. */
  message: string;
  /** Optional list of the specific consequences. */
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * When set, the user must type this exact value to enable confirmation —
   * used for irreversible or secret-bearing operations.
   */
  requireTypedPhrase?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export function ConfirmationDialog({
  visible,
  title,
  message,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  requireTypedPhrase,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmationDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  const phraseSatisfied = !requireTypedPhrase || typed.trim() === requireTypedPhrase;
  const canConfirm = phraseSatisfied && !busy;

  return (
    <Modal
      visible={visible}
      title={title}
      onClose={onCancel}
      dismissible={!busy}
      footer={
        <>
          <Button
            label={cancelLabel}
            variant="secondary"
            onPress={onCancel}
            disabled={busy}
            style={{ flex: 1 }}
          />
          <Button
            label={confirmLabel}
            variant={destructive ? 'destructive' : 'primary'}
            onPress={onConfirm}
            disabled={!canConfirm}
            loading={busy}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Stack gap={spacing.xl}>
        <Row gap={spacing.lg} align="flex-start">
          {destructive ? (
            <ShieldAlert size={22} color={colors.danger} style={{ marginTop: 2 }} />
          ) : (
            <AlertTriangle size={22} color={colors.warning} style={{ marginTop: 2 }} />
          )}
          <Text variant="body" tone="secondary" style={{ flex: 1 }}>
            {message}
          </Text>
        </Row>

        {details && details.length > 0 ? (
          <View style={styles.details}>
            {details.map((detail) => (
              <Row key={detail} gap={spacing.md} align="flex-start">
                <Text variant="monoSmall" tone="muted">
                  •
                </Text>
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  {detail}
                </Text>
              </Row>
            ))}
          </View>
        ) : null}

        {requireTypedPhrase ? (
          <Stack gap={spacing.md}>
            <Text variant="label" tone="muted">
              Type {requireTypedPhrase} to continue
            </Text>
            <Input
              value={typed}
              onChangeText={setTyped}
              placeholder={requireTypedPhrase}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              accessibilityLabel={`Type ${requireTypedPhrase} to confirm`}
            />
            {phraseSatisfied ? (
              <Text variant="caption" tone="success">
                Phrase matched.
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Modal>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
});