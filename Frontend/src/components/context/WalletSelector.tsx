/**
 * WalletSelector — the single wallet-context control.
 *
 * DESIGN.md §12 — one authoritative selected-wallet state, shared by Home,
 * Wallets, Portfolio, Assets, Activity, Receive, Alerts, Risk, Intelligence,
 * Accounting and Send/Trade. Screens render this component (as a compact
 * trigger or an inline control) and never build their own picker.
 *
 * The selection sheet itself is opened through the shell's single sheet
 * host, so it looks identical wherever it is summoned from.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, ChevronDown, Layers } from 'lucide-react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Divider, Row, Stack } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { WalletAvatar } from '@/components/utility';
import { useSheet } from '@/components/chrome/shell-context';
import { ALL_WALLETS, useWalletContext } from '@/stores/wallet-context';
import { routes } from '@/navigation/config';
import { formatUsd } from '@/utils/format';
import { usePortfolioSummary, useWallets } from '@/hooks/useApi';

/** Resolves the selected wallet object, or null for ALL WALLETS. */
export function useSelectedWallet() {
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const wallets = useWallets();
  const selected =
    selectedWalletId && wallets.data
      ? (wallets.data.find((w) => w.id === selectedWalletId) ?? null)
      : null;
  return { selectedWalletId, selected, isLoading: wallets.isLoading };
}

export function WalletSelector({
  variant = 'trigger',
  style,
  testID,
}: {
  /** `trigger` sits in the App Bar; `inline` sits in page content. */
  variant?: 'trigger' | 'inline';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { open } = useSheet();
  const { selected, isLoading } = useSelectedWallet();

  const label = selected ? selected.label : 'All Wallets';
  const sublabel = selected
    ? selected.group ?? (selected.watch_only ? 'Watch only' : 'Standard')
    : 'Aggregated across every wallet';

  const onPress = () => open({ title: 'Select wallet', render: (close) => <WalletSheet onClose={close} /> });

  if (variant === 'inline') {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Wallet context: ${label}. Change`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.inline,
          pressed ? { backgroundColor: colors.surfaceHover } : null,
          style,
        ]}
      >
        <Row gap={spacing.lg} align="center">
          {selected ? (
            <WalletAvatar address={selected.address} label={selected.label} size={34} />
          ) : (
            <View style={styles.allIcon}>
              <Layers size={17} color={colors.accent} />
            </View>
          )}
          <View style={styles.inlineText}>
            <Text variant="overline" tone="muted">
              Wallet Context
            </Text>
            <Text variant="body" numberOfLines={1}>
              {isLoading ? 'Loading…' : label}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {sublabel}
            </Text>
          </View>
          <ChevronDown size={16} color={colors.textMuted} />
        </Row>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Wallet context: ${label}. Change`}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.trigger, pressed ? { opacity: 0.7 } : null, style]}
    >
      <Row gap={spacing.sm} style={{ maxWidth: 150 }}>
        {selected ? (
          <WalletAvatar address={selected.address} label={selected.label} size={22} />
        ) : (
          <Layers size={14} color={colors.accent} />
        )}
        <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
          {isLoading ? '…' : label}
        </Text>
      </Row>
      <ChevronDown size={13} color={colors.textMuted} />
    </Pressable>
  );
}

/* ────────────────────────  SELECTION SHEET  ──────────────────────── */

function WalletSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const wallets = useWallets();
  const summary = usePortfolioSummary();
  const { selectedWalletId, select } = useWalletContext();

  const walletValue = (walletId: string) =>
    summary.data?.wallet_values_usd?.[walletId] ?? 0;

  const totalWallets = wallets.data?.length ?? 0;
  const totalValue = summary.data?.total_value_usd ?? 0;

  if (wallets.isLoading) {
    return (
      <Stack gap={spacing.lg}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeleton} />
        ))}
      </Stack>
    );
  }

  if (wallets.isError) {
    return (
      <Stack gap={spacing.md}>
        <Text variant="body" tone="secondary">
          Wallets could not be loaded.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void wallets.refetch()}>
          <Text variant="label" tone="accent">
            RETRY
          </Text>
        </Pressable>
      </Stack>
    );
  }

  return (
    <Stack gap={spacing.md}>
      {/* ALL WALLETS is always offered first and is the default context. */}
      <SheetOption
        selected={selectedWalletId === ALL_WALLETS}
        onPress={() => {
          select(ALL_WALLETS);
          onClose();
        }}
        title="All Wallets"
        subtitle={
          totalWallets > 0
            ? `${totalWallets} wallet${totalWallets === 1 ? '' : 's'} · ${formatUsd(totalValue)}`
            : 'No wallets yet'
        }
        leading={<Layers size={18} color={colors.accent} />}
      />

      {(wallets.data ?? []).length === 0 ? (
        <Text variant="caption" tone="muted" align="center" style={{ paddingVertical: spacing.lg }}>
          Create your first wallet to change the wallet context.
        </Text>
      ) : (
        <>
          <Divider />
          <Text variant="overline" tone="muted">
            Individual Wallets
          </Text>
          {(wallets.data ?? []).map((wallet) => (
            <SheetOption
              key={wallet.id}
              selected={selectedWalletId === wallet.id}
              onPress={() => {
                select(wallet.id);
                onClose();
              }}
              onOpenDetail={() => {
                select(wallet.id);
                onClose();
                router.push(routes.walletDetail(wallet.id) as never);
              }}
              title={wallet.label}
              subtitle={wallet.address}
              leading={<WalletAvatar address={wallet.address} label={wallet.label} size={34} />}
              trailingValue={formatUsd(walletValue(wallet.id))}
              badges={
                <Row gap={spacing.sm} wrap>
                  {wallet.watch_only ? <StatusBadge status="watch only" size="sm" /> : null}
                  {wallet.cold_storage ? <StatusBadge status="cold storage" size="sm" /> : null}
                  {!wallet.signing_enabled && !wallet.watch_only ? (
                    <StatusBadge status="signing disabled" size="sm" />
                  ) : null}
                </Row>
              }
            />
          ))}
        </>
      )}
    </Stack>
  );
}

function SheetOption({
  selected,
  onPress,
  onOpenDetail,
  title,
  subtitle,
  leading,
  trailing,
  trailingValue,
  badges,
}: {
  selected: boolean;
  onPress: () => void;
  onOpenDetail?: () => void;
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  trailingValue?: string;
  badges?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={onOpenDetail}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed ? { backgroundColor: colors.surfaceHover } : null,
      ]}
    >
      <Row gap={spacing.lg} align="center">
        {leading}
        <View style={styles.optionBody}>
          <Row justify="space-between" align="center" gap={spacing.md}>
            <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </Text>
            {trailingValue ? (
              <Text variant="monoSmall" tone="secondary">
                {trailingValue}
              </Text>
            ) : null}
            {selected ? <Check size={16} color={colors.accent} /> : null}
          </Row>
          {subtitle ? (
            <Text variant="monoSmall" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {badges}
        </View>
        {trailing}
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 170,
  },
  inline: {
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  inlineText: { flex: 1, gap: spacing.xxs },
  allIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  option: {
    padding: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  optionBody: { flex: 1, gap: spacing.xxs },
  skeleton: {
    height: 58,
    borderRadius: radii.control,
    backgroundColor: colors.skeleton,
  },
});