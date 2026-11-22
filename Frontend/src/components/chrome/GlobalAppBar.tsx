/**
 * GlobalAppBar — the single application bar.
 *
 * This component is mounted once, by `AppShell`. No screen may render its own
 * header: a screen declares its identity through `usePageMeta(...)` and this
 * bar renders it. That is what makes "one app bar" a structural guarantee
 * rather than a convention.
 *
 * Layout (DESIGN.md §20, §21):
 *   row 1  page title · subtitle            [wallet] [alerts] [search]
 *   row 2  context line                        connection / vault state
 *
 * The bar is fixed-height so content never reflows when a title changes.
 */

import { memo, useCallback } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Search, ShieldCheck } from 'lucide-react-native';

import { colors, elevation, layout, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Row, Spacer } from '@/components/primitives';
import { AlertIndicator } from '@/components/context/AlertIndicator';
import { ConnectionIndicator } from '@/components/context/ConnectionIndicator';
import { WalletSelector } from '@/components/context/WalletSelector';
import { useShellMeta } from './useShellMeta';
import { PRODUCT_NAME } from './PageHeader';
import { routes } from '@/navigation/config';

export const GlobalAppBar = memo(function GlobalAppBar() {
  const meta = useShellMeta();
  const router = useRouter();
  const pathname = usePathname();

  const openSearch = useCallback(() => {
    if (pathname === routes.search) return;
    router.push(routes.search as never);
  }, [pathname, router]);

  return (
    <View style={styles.bar}>
      <View style={styles.primaryRow}>
        <View style={styles.titleBlock}>
          <Text variant="overline" tone="muted" numberOfLines={1}>
            {PRODUCT_NAME}
          </Text>
          <Text variant="h2" numberOfLines={1} accessibilityRole="header">
            {meta?.title ?? 'SOLANA VAULT'}
          </Text>
        </View>

        <Row gap={spacing.xs} align="center">
          {meta?.showWalletSelector ? <WalletSelector variant="trigger" /> : null}
          <AlertIndicator />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            hitSlop={6}
            testID="appbar-search"
            onPress={openSearch}
            style={({ pressed }) => [
              styles.iconSlot,
              pressed ? { backgroundColor: colors.surfaceHover } : null,
            ]}
          >
            <Search size={19} color={colors.textSecondary} />
          </Pressable>
        </Row>
      </View>

      <View style={styles.contextRow}>
        <Row gap={spacing.sm} style={styles.contextLeft}>
          <ShieldCheck size={12} color={colors.textMuted} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={styles.contextText}>
            {meta?.subtitle ?? 'Solana only · no other chain is supported'}
          </Text>
        </Row>
        <Spacer size={0} />
        <ConnectionIndicator compact />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...elevation.bar,
  },
  primaryRow: {
    minHeight: layout.appBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  titleBlock: { flex: 1, gap: spacing.xxs },
  contextRow: {
    minHeight: layout.appBarContextHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  contextLeft: { flex: 1, gap: spacing.sm },
  contextText: { flexShrink: 1 },
  iconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
  },
});