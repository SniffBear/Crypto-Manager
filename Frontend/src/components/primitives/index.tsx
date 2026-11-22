/**
 * Core UI primitives.
 *
 * DESIGN.md §16 (buttons/inputs) and §15 (surfaces) require a normalised,
 * reusable set. Screens compose these instead of declaring their own
 * shapes, colours, borders or pressed states.
 */

import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, layout, radii, spacing, typography, type Tone } from '@/design/tokens';
import { Text } from './Text';
import { monoFontFor } from '@/design/tokens';
import { Platform } from 'react-native';

/* ═════════════════════════════  BUTTON  ═════════════════════════════ */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'destructive'
  | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Leading glyph. */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const BUTTON_HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 46, lg: 54 };
const BUTTON_PAD_H: Record<ButtonSize, number> = { sm: spacing.lg, md: spacing.xl, lg: spacing.xxl };
const BUTTON_RADIUS: Record<ButtonSize, number> = {
  sm: radii.control,
  md: radii.control,
  lg: radii.card,
};

interface ButtonSkin {
  bg: string;
  bgPressed: string;
  border: string;
  fg: string;
  disabledBg: string;
  disabledFg: string;
}

const BUTTON_SKIN: Record<ButtonVariant, ButtonSkin> = {
  primary: {
    bg: colors.accent,
    bgPressed: colors.accentPressed,
    border: colors.accent,
    fg: colors.onAccent,
    disabledBg: colors.surfaceElevated,
    disabledFg: colors.textMuted,
  },
  secondary: {
    bg: colors.surfaceElevated,
    bgPressed: colors.surfaceHover,
    border: colors.borderStrong,
    fg: colors.text,
    disabledBg: colors.surface,
    disabledFg: colors.textMuted,
  },
  tertiary: {
    bg: 'transparent',
    bgPressed: colors.surfaceElevated,
    border: 'transparent',
    fg: colors.accent,
    disabledBg: 'transparent',
    disabledFg: colors.textMuted,
  },
  destructive: {
    bg: colors.danger,
    bgPressed: '#C24444',
    border: colors.danger,
    fg: '#1A0A0A',
    disabledBg: colors.surfaceElevated,
    disabledFg: colors.textMuted,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: colors.surfaceElevated,
    border: 'transparent',
    fg: colors.textSecondary,
    disabledBg: 'transparent',
    disabledFg: colors.textMuted,
  },
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    label,
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon,
    style,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const skin = BUTTON_SKIN[variant];
  const typeVariant = size === 'sm' ? 'label' : 'body';
  const typeWeight = variant === 'primary' || variant === 'destructive' ? '600' : '500';

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.buttonBase,
        {
          height: BUTTON_HEIGHT[size],
          paddingHorizontal: BUTTON_PAD_H[size],
          borderRadius: BUTTON_RADIUS[size],
          backgroundColor: isDisabled
            ? skin.disabledBg
            : pressed
              ? skin.bgPressed
              : skin.bg,
          borderColor: isDisabled ? colors.border : skin.border,
          borderWidth: skin.border === 'transparent' ? 0 : StyleSheet.hairlineWidth * 2,
          opacity: pressed && !isDisabled ? 0.94 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isDisabled ? skin.disabledFg : skin.fg} />
      ) : (
        <>
          {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
          <Text
            variant={typeVariant}
            style={{ color: isDisabled ? skin.disabledFg : skin.fg, fontWeight: typeWeight }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
});

/* ═══════════════════════════  ICON BUTTON  ═══════════════════════════ */

export type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  accessibilityLabel: string;
  /**
   * Box size of the touch target. Defaults to the minimum in
   * DESIGN.md §35; screens should rarely pass anything smaller.
   */
  size?: number;
  tone?: 'default' | 'muted' | 'danger' | 'accent';
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  children,
  accessibilityLabel,
  size = layout.minTouchTarget,
  tone = 'default',
  active = false,
  style,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        {
          minWidth: size,
          minHeight: size,
          backgroundColor: active
            ? colors.accentMuted
            : pressed
              ? colors.surfaceHover
              : 'transparent',
        },
        style,
      ]}
      {...rest}
    >
      {(state) => <View style={{ opacity: state.pressed ? 0.7 : 1 }}>{children}</View>}
    </Pressable>
  );
}

/* ══════════════════════════  SURFACES  ══════════════════════════ */

export type CardProps = {
  children: React.ReactNode;
  /** `flat` removes the border — used for nested/inset surfaces. */
  variant?: 'default' | 'elevated' | 'flat' | 'accent' | 'danger' | 'warning' | 'success';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const CARD_VARIANT: Record<NonNullable<CardProps['variant']>, ViewStyle> = {
  default: { backgroundColor: colors.surface },
  elevated: { backgroundColor: colors.surfaceElevated },
  flat: { backgroundColor: 'transparent' },
  accent: { backgroundColor: colors.accentMuted },
  danger: { backgroundColor: colors.dangerMuted },
  warning: { backgroundColor: colors.warningMuted },
  success: { backgroundColor: colors.successMuted },
};

export function Card({ children, variant = 'default', padded = true, style, testID }: CardProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        CARD_VARIANT[variant],
        variant === 'flat' ? null : styles.cardBordered,
        padded ? styles.cardPadded : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Section wrapper providing consistent vertical rhythm between blocks. */
export function Section({
  children,
  gap = spacing.xl,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset },
        style,
      ]}
    />
  );
}

/* ═══════════════════════════  INPUT  ═══════════════════════════ */

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  /** Renders the value in the monospaced numeric/technical face. */
  mono?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, hint, error, mono = false, right, style, ...rest },
  ref,
) {
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {label ? (
        <Text variant="overline" tone="muted">
          {label}
        </Text>
      ) : null}
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          style={[
            styles.input,
            mono ? { fontFamily: monoFontFor(Platform.OS) } : null,
          ]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/* ═══════════════════════════  CHIP  ═══════════════════════════ */

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: Tone;
  count?: number;
};

export function Chip({ label, selected = false, onPress, tone = 'neutral', count }: ChipProps) {
  const skin = tone === 'neutral' ? null : TONE_SKIN[tone];
  const fg = selected ? colors.accent : (skin?.fg ?? colors.textSecondary);
  const bg = selected ? colors.accentMuted : (skin?.bg ?? colors.surfaceElevated);
  const border = selected ? colors.accent : (skin?.border ?? colors.border);

  const content = (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: border }]}>
      <Text variant="label" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text variant="monoSmall" tone={selected ? 'accent' : 'muted'}>
          {count}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
    >
      {content}
    </Pressable>
  );
}

const TONE_SKIN: Record<Tone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: colors.textSecondary, bg: colors.surfaceElevated, border: colors.border },
  accent: { fg: colors.accent, bg: colors.accentMuted, border: colors.accent },
  success: { fg: colors.success, bg: colors.successMuted, border: colors.success },
  warning: { fg: colors.warning, bg: colors.warningMuted, border: colors.warning },
  danger: { fg: colors.danger, bg: colors.dangerMuted, border: colors.danger },
  info: { fg: colors.info, bg: colors.infoMuted, border: colors.info },
  stale: { fg: colors.stale, bg: colors.staleMuted, border: colors.stale },
};

/* ═══════════════════════  LAYOUT HELPERS  ═══════════════════════ */

export function Row({
  children,
  gap = spacing.md,
  align = 'center',
  justify = 'flex-start',
  wrap = false,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, justifyContent: justify, gap },
        wrap ? { flexWrap: 'wrap' } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Stack({
  children,
  gap = spacing.lg,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** Flexible spacer for pushing trailing content in a Row. */
export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size, flex: 1 }} />;
}

/* ══════════════════════  KEY / VALUE DISPLAY  ══════════════════════
 * The canonical "technical field" row used by every detail screen so
 * label/value pairs never drift between pages.
 * ─────────────────────────────────────────────────────────────────── */
export function KeyValue({
  label,
  value,
  valueColor,
  mono = true,
  align = 'between',
}: {
  label: string;
  value: React.ReactNode;
  /** Escape hatch for tone only — still rendered with the mono face when mono. */
  valueColor?: string;
  mono?: boolean;
  align?: 'between' | 'start';
}) {
  return (
    <View
      style={[
        styles.keyValue,
        align === 'between' ? { flexDirection: 'row', alignItems: 'flex-start' } : null,
      ]}
    >
      <Text variant="label" tone="muted" style={styles.keyValueLabel}>
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text
          variant={mono ? 'monoSmall' : 'body'}
          style={[styles.keyValueValue, align === 'between' ? styles.keyValueValueEnd : null, valueColor ? { color: valueColor } : null]}
          numberOfLines={mono ? 2 : undefined}
        >
          {value}
        </Text>
      ) : (
        <View style={align === 'between' ? styles.keyValueValueEnd : null}>{value}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  buttonIcon: { marginRight: 0 },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
  },
  card: {
    borderRadius: radii.card,
  },
  cardBordered: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  cardPadded: {
    padding: spacing.xl,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  inputWrapError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    paddingVertical: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  keyValue: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  keyValueLabel: {
    flexShrink: 0,
  },
  keyValueValue: {
    flex: 1,
  },
  keyValueValueEnd: {
    marginLeft: spacing.lg,
    textAlign: 'right',
  },
});

export { TONE_SKIN };
export type { TextStyle, Tone };