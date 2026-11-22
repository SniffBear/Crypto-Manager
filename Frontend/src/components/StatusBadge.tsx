/**
 * StatusBadge — the single status component for the entire application.
 *
 * DESIGN.md §9 forbids colour-only meaning, so every badge renders a glyph
 * AND an explicit text label. Screens pass a raw backend status; the label,
 * tone and glyph are resolved by the shared registry.
 *
 * There is exactly one visual treatment. Pages do not build their own.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AlertTriangle, Check, Lock, LockOpen, Radio, RefreshCw, Slash, Timer, FlaskConical, Circle } from 'lucide-react-native';

import { radii, spacing, toneColors, type Tone } from '@/design/tokens';
import { statusFor, type StatusGlyph } from '@/design/status';
import { Text } from './primitives/Text';

const GLYPH_SIZE = 11;

const GLYPH_COMPONENT: Record<StatusGlyph, typeof Circle> = {
  dot: Circle,
  lock: Lock,
  unlock: LockOpen,
  signal: Radio,
  sync: RefreshCw,
  alert: AlertTriangle,
  check: Check,
  cross: AlertTriangle,
  slash: Slash,
  clock: Timer,
  flask: FlaskConical,
};

export type StatusBadgeProps = {
  /** Raw status from the backend/domain — resolved via the shared registry. */
  status: string;
  /** Pre-resolved override, used when a caller already knows the tone. */
  label?: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

export function StatusBadge({ status, label, tone, size = 'md', style }: StatusBadgeProps) {
  const definition = statusFor(status);
  const resolvedTone: Tone = tone ?? definition.tone;
  const skin = toneColors[resolvedTone];
  const resolvedLabel = label ?? definition.label;
  const Glyph = GLYPH_COMPONENT[definition.glyph] ?? Circle;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${resolvedLabel}`}
      style={[
        styles.badge,
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: skin.bg, borderColor: skin.border },
        style,
      ]}
    >
      <Glyph size={GLYPH_SIZE} color={skin.fg} strokeWidth={2.5} />
      <Text
        variant="overline"
        style={{ color: skin.fg, fontSize: size === 'sm' ? 9 : 10, lineHeight: size === 'sm' ? 12 : 14 }}
        numberOfLines={1}
      >
        {resolvedLabel}
      </Text>
    </View>
  );
}

/** Bare status dot for dense rows where the full badge would crowd (§18). */
export function StatusDot({ status, size = 7 }: { status: string; size?: number }) {
  const { tone } = statusFor(status);
  const skin = toneColors[tone];
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: skin.fg,
      }}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  badgeSm: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 1,
  },
});