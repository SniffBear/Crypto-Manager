/**
 * Small display utilities shared by every screen.
 *
 * DESIGN.md §17 — long addresses and identifiers always receive a shortened
 * display, a copy action, an accessible full value and an explorer link
 * where supported. Those behaviours live here, once.
 */

import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Copy } from 'lucide-react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Row } from '@/components/primitives';
import { useCopy } from '@/hooks/useCopy';
import { shorten } from '@/utils/format';

/* ───────────────────────────  COPY BUTTON  ─────────────────────────── */

export function CopyButton({
  value,
  label,
  size = 16,
  tone = 'muted',
  style,
}: {
  value: string;
  /** What is being copied, used for the toast and accessible label. */
  label: string;
  size?: number;
  tone?: 'muted' | 'default' | 'accent';
  style?: StyleProp<ViewStyle>;
}) {
  const { state, copy } = useCopy();
  const color =
    state === 'copied'
      ? colors.success
      : tone === 'accent'
        ? colors.accent
        : tone === 'default'
          ? colors.text
          : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      accessibilityState={{ busy: state === 'copied' }}
      hitSlop={10}
      onPress={() => void copy(value, label)}
      style={({ pressed }) => [styles.copyButton, style, { opacity: pressed ? 0.6 : 1 }]}
    >
      {state === 'copied' ? (
        <Check size={size} color={colors.success} />
      ) : (
        <Copy size={size} color={color} />
      )}
    </Pressable>
  );
}

/* ─────────────────────────  ADDRESS DISPLAY  ───────────────────────── */

export type AddressDisplayProps = {
  value: string;
  /** Accessible noun, e.g. "wallet address" or "token mint". */
  kind?: string;
  lead?: number;
  tail?: number;
  /** Show the copy affordance. */
  copyable?: boolean;
  /** Offer a Solana explorer link when the value looks like an address/signature. */
  explorer?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const EXPLORER_BASE = 'https://solscan.io';

function explorerPath(value: string): string | null {
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
    // 32 bytes decode to a 32–44 char base58 address; signatures are longer.
    return value.length <= 44 ? `/account/${value}` : `/tx/${value}`;
  }
  return null;
}

export function AddressDisplay({
  value,
  kind = 'value',
  lead = 4,
  tail = 4,
  copyable = true,
  explorer = true,
  size = 'md',
  style,
}: AddressDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const path = explorer ? explorerPath(value) : null;
  const variant = size === 'sm' ? 'monoSmall' : size === 'lg' ? 'mono' : 'monoSmall';

  const openExplorer = () => {
    if (!path) return;
    void Linking.openURL(`${EXPLORER_BASE}${path}`).catch(() => {
      /* Opening an external link can fail; never surface it as an app error. */
    });
  };

  return (
    <Row gap={spacing.sm} style={style} wrap={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? `Hide full ${kind}` : `Show full ${kind}: ${value}`
        }
        onPress={() => setExpanded((prev) => !prev)}
        hitSlop={6}
      >
        <Text variant={variant} tone="secondary" numberOfLines={1}>
          {expanded ? value : shorten(value, lead, tail)}
        </Text>
      </Pressable>

      {copyable ? <CopyButton value={value} label={kind} size={14} /> : null}

      {path ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`View ${kind} on Solscan`}
          hitSlop={8}
          onPress={openExplorer}
        >
          <Text variant="caption" tone="accent">
            EXPLORE
          </Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

/* ───────────────────────────  TOKEN ICON  ─────────────────────────── */

/**
 * DESIGN.md §36/§1 — no fabricated imagery. The token mark is derived
 * deterministically from the mint (and optionally the symbol), so the same
 * asset always renders the same mark without inventing a logo.
 */
export function TokenIcon({
  mint,
  symbol,
  size = 36,
  style,
}: {
  mint: string;
  symbol?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const seed = hashString(mint);
  const hue = seed % 360;
  const background = `hsl(${hue}, 32%, 22%)`;
  const border = `hsl(${hue}, 38%, 34%)`;
  const label = (symbol ?? mint).slice(0, 2).toUpperCase();

  return (
    <View
      accessible={false}
      style={[
        styles.tokenIcon,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: background,
          borderColor: border,
        },
        style,
      ]}
    >
      <Text
        variant="overline"
        style={{ fontSize: size * 0.32, lineHeight: size * 0.4, color: colors.textSecondary }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ──────────────────────────  WALLET AVATAR  ────────────────────────── */

export function WalletAvatar({
  address,
  label,
  size = 36,
  style,
}: {
  address: string;
  label?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const seed = hashString(address);
  const hue = seed % 360;
  const initial = (label ?? address).trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      accessible={false}
      style={[
        styles.tokenIcon,
        {
          width: size,
          height: size,
          borderRadius: radii.control,
          backgroundColor: `hsl(${hue}, 30%, 20%)`,
          borderColor: `hsl(${hue}, 36%, 32%)`,
        },
        style,
      ]}
    >
      <Text
        variant="overline"
        style={{ fontSize: size * 0.38, lineHeight: size * 0.46, color: colors.textSecondary }}
      >
        {initial}
      </Text>
    </View>
  );
}

/** Stable 32-bit hash so derived colours never change between renders. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const styles = StyleSheet.create({
  copyButton: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});