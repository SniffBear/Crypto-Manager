/**
 * Typography primitive.
 *
 * This is the ONLY way text is rendered in the application. Screens cannot
 * pass a raw `fontSize`/`fontFamily`/`fontWeight`, which is what guarantees
 * DESIGN.md §8 — one type hierarchy, and §13 — a single monospaced numeric
 * system across every screen.
 *
 * Rule encoded here: anything numeric or technical must use a `mono*`
 * variant; anything editorial (label, prose, navigation) uses the
 * proportional sans.
 */

import { StyleSheet, Text as RNText, type StyleProp, type TextStyle } from 'react-native';
import { Platform } from 'react-native';

import { colors, monoFontFor, typography, type TypeVariant } from '@/design/tokens';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'muted'
  /** Semantic "no state" — kept so a `Tone` can be passed straight through. */
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'stale'
  | 'inverse';

export type TextProps = {
  children?: React.ReactNode;
  variant?: TypeVariant;
  tone?: TextTone;
  /** Overrides the variant's colour only — never its size or family. */
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityRole?: 'header' | 'text' | 'link';
  accessibilityLabel?: string;
};

const TONE_COLOR: Record<TextTone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  neutral: colors.textSecondary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  stale: colors.stale,
  inverse: colors.textInverse,
};

const ROLE_VARIANT: Record<'header' | 'text' | 'link', TypeVariant> = {
  header: 'h2',
  text: 'body',
  link: 'body',
};

export function Text({
  children,
  variant = 'body',
  tone = 'default',
  align = 'left',
  numberOfLines,
  style,
  testID,
  accessibilityRole,
  accessibilityLabel,
}: TextProps) {
  const spec = typography[variant];
  const resolvedVariant = accessibilityRole ? ROLE_VARIANT[accessibilityRole] : variant;

  return (
    <RNText
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={numberOfLines}
      style={[
        styles.base,
        {
          fontSize: typography[resolvedVariant].fontSize,
          lineHeight: typography[resolvedVariant].lineHeight,
          fontWeight: typography[resolvedVariant].fontWeight,
          letterSpacing: typography[resolvedVariant].letterSpacing,
          textTransform: typography[resolvedVariant].textTransform,
          color: TONE_COLOR[tone],
        },
        // Monospaced variants (§8 numeric/technical system).
        spec.mono || typography[resolvedVariant].mono
          ? { fontFamily: monoFontFor(Platform.OS) }
          : null,
        align === 'center' ? styles.center : null,
        align === 'right' ? styles.right : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
    // Prevents iOS/Android from applying an unexpected default weight.
    includeFontPadding: false,
  },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
});

/**
 * Convenience wrappers for the semantic numeric roles named in DESIGN.md
 * §8/§13. Using these instead of ad-hoc mono variants makes the numeric
 * system self-documenting at the call site.
 */
export const Numeral = {
  /** Portfolio totals. */
  Display: (p: Omit<TextProps, 'variant'>) => <Text {...p} variant="display" />,
  /** Prices, balances, amounts, percentages. */
  Value: (p: Omit<TextProps, 'variant'>) => <Text {...p} variant="mono" />,
  /** Prominent values inside cards. */
  ValueLarge: (p: Omit<TextProps, 'variant'>) => <Text {...p} variant="monoLarge" />,
  /** Addresses, signatures, mints, hashes, slots, RPC diagnostics. */
  Technical: (p: Omit<TextProps, 'variant'>) => <Text {...p} variant="monoSmall" />,
};