/**
 * Toast host.
 *
 * A single host mounted by the AppShell, so every screen raises toasts
 * through the same surface (DESIGN.md §24). Toasts auto-dismiss and are
 * announced to screen readers via the live region.
 */

import { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, X, AlertCircle } from 'lucide-react-native';

import { colors, duration, radii, spacing, toneColors, type Tone } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { IconButton, Row } from '@/components/primitives';
import { useToastStore, type Toast } from '@/stores/toast';

const TONE_ICON: Record<Tone, typeof Info> = {
  neutral: Info,
  accent: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  stale: Info,
};

const TOAST_LIFETIME_MS = 4000;

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const skin = toneColors[toast.tone];
  const IconComponent = TONE_ICON[toast.tone];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.toast, { borderLeftColor: skin.border }]}
    >
      <Row gap={spacing.lg} align="flex-start" style={{ flex: 1 }}>
        <IconComponent size={18} color={skin.fg} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="label">{toast.message}</Text>
          {toast.detail ? (
            <Text variant="caption" tone="secondary">
              {toast.detail}
            </Text>
          ) : null}
        </View>
      </Row>
      <IconButton
        accessibilityLabel="Dismiss notification"
        onPress={() => dismiss(toast.id)}
        tone="muted"
      >
        <X size={16} color={colors.textMuted} />
      </IconButton>
    </View>
  );
}

/** Mounted once, by the AppShell. */
export function ToastHost({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        { bottom: insets.bottom + bottomOffset + spacing.lg, paddingHorizontal: spacing.xl },
      ]}
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

/** Fade helper reused by the sheet host. */
export function fadeIn(value: Animated.Value) {
  return Animated.timing(value, {
    toValue: 1,
    duration: duration.normal,
    useNativeDriver: true,
  });
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    gap: spacing.md,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderStrong,
    borderLeftWidth: 3,
  },
});