/**
 * GlobalBottomNavigation — the canonical bottom navigation.
 *
 * Exactly four destinations, in the order fixed by the refactor contract:
 *     VAULT · WALLETS · ACTIVITY · MENU
 *
 * The 61 mockups proposed ten mutually incompatible navigation schemes
 * (sidebars, tab bars, FAB menus, in-page segmented strips). They are not
 * reproduced here. This bar is the only primary navigation, and it is driven
 * entirely by `PRIMARY_DESTINATIONS` so a destination can never appear in the
 * Menu and be missing from the bar, or vice versa.
 *
 * DESIGN.md §22, §34, §35 — full-width touch targets, active state shown by
 * colour *and* label weight, no colour-only signalling.
 */

import { memo, useCallback } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, layout, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Icon } from '@/components/Icon';
import { activePrimaryKey, PRIMARY_DESTINATIONS } from '@/navigation/config';

export const GlobalBottomNavigation = memo(function GlobalBottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const active = activePrimaryKey(pathname);

  const go = useCallback(
    (href: string) => {
      if (pathname === href) return;
      router.push(href as never);
    },
    [pathname, router],
  );

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {PRIMARY_DESTINATIONS.map((destination) => {
        const isActive = destination.key === active;
        return (
          <Pressable
            key={destination.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${destination.label}. ${destination.description}`}
            testID={`bottom-nav-${destination.key}`}
            onPress={() => go(destination.href)}
            style={({ pressed }) => [
              styles.item,
              pressed ? { backgroundColor: colors.surfaceHover } : null,
            ]}
          >
            <View
              style={[styles.indicator, isActive ? styles.indicatorActive : null]}
              accessibilityElementsHidden
            />
            <Icon
              name={destination.icon}
              size={21}
              color={isActive ? colors.accent : colors.textMuted}
              strokeWidth={isActive ? 2.4 : 1.9}
            />
            <Text
              variant="overline"
              numberOfLines={1}
              style={{
                color: isActive ? colors.accent : colors.textMuted,
                fontWeight: isActive ? '700' : '600',
                fontSize: 10,
                lineHeight: 13,
              }}
            >
              {destination.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    ...elevation.bar,
  },
  item: {
    flex: 1,
    minHeight: layout.bottomNavHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    // Generous horizontal padding keeps every target ≥ 44pt wide (DESIGN.md §35).
    paddingHorizontal: spacing.sm,
    borderRadius: radii.control,
  },
  indicator: {
    position: 'absolute',
    top: -spacing.md,
    height: 2,
    width: 26,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
  },
  indicatorActive: { backgroundColor: colors.accent },
});