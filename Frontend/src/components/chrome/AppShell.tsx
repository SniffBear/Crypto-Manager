/**
 * AppShell — the one authenticated frame.
 *
 * Mounted once, by `app/(app)/_layout.tsx`. Everything below it is a page
 * that declares its identity (`usePageMeta`) and its content
 * (`PageContainer`). No page can add chrome, because the chrome is here and
 * nowhere else.
 *
 *   ┌──────────────────────────────┐
 *   │ GlobalAppBar                 │  fixed
 *   ├──────────────────────────────┤
 *   │                              │
 *   │   page content               │  scrolls, one bounded measure
 *   │                              │
 *   ├──────────────────────────────┤
 *   │ GlobalBottomNavigation       │  fixed (rail on wide displays)
 *   └──────────────────────────────┘
 *
 * DESIGN.md §34 — wide displays swap the bottom bar for a rail. The
 * destinations are identical in both modes; only the presentation changes.
 */

import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Spacer } from '@/components/primitives';
import { Icon } from '@/components/Icon';
import { GlobalAppBar } from './GlobalAppBar';
import { GlobalBottomNavigation } from './GlobalBottomNavigation';
import { ToastHost } from '@/components/feedback/Toast';
import { ConfirmationProvider } from '@/components/feedback/confirmation-context';
import { ShellProvider } from './shell-context';
import { useNavigationMode } from '@/hooks/useResponsive';
import { useAuthStore } from '@/stores/auth';
import { useEventSocket } from '@/ws/manager';
import { activePrimaryKey, PRIMARY_DESTINATIONS } from '@/navigation/config';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <ConfirmationProvider>
        <ShellFrame>{children}</ShellFrame>
      </ConfirmationProvider>
    </ShellProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const mode = useNavigationMode();
  const unlocked = useAuthStore((s) => s.phase === 'unlocked');

  // The realtime socket exists only while a session exists.
  useEventSocket(unlocked);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GlobalAppBar />

      <View style={styles.body}>
        {mode === 'rail' ? <NavigationRail /> : null}
        <View style={styles.content}>{children}</View>
      </View>

      {mode === 'bar' ? (
        <GlobalBottomNavigation />
      ) : (
        <View style={{ height: spacing.xl }} />
      )}

      <ToastHost bottomOffset={mode === 'bar' ? layout.bottomNavHeight : 0} />
    </View>
  );
}

/* ───────────────────────  WIDE-DISPLAY NAV RAIL  ─────────────────────── */

function NavigationRail() {
  const router = useRouter();
  const pathname = usePathname();
  const active = activePrimaryKey(pathname);

  return (
    <View style={[styles.rail, { paddingBottom: spacing.xl }]}>
      <View style={styles.railBrand}>
        <Text variant="overline" tone="muted" numberOfLines={2}>
          SOLANA VAULT
        </Text>
      </View>

      <View style={styles.railItems}>
        {PRIMARY_DESTINATIONS.map((destination) => {
          const isActive = destination.key === active;
          return (
            <Pressable
              key={destination.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={destination.label}
              onPress={() => {
                if (pathname !== destination.href) router.push(destination.href as never);
              }}
              style={({ pressed }) => [
                styles.railItem,
                isActive ? styles.railItemActive : null,
                pressed ? { backgroundColor: colors.surfaceHover } : null,
              ]}
            >
              <Icon
                name={destination.icon}
                size={19}
                color={isActive ? colors.accent : colors.textMuted}
              />
              <Text
                variant="label"
                numberOfLines={1}
                style={{ color: isActive ? colors.accent : colors.textSecondary, flex: 1 }}
              >
                {destination.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Spacer size={0} />
    </View>
  );
}

/* ───────────────────────────  SHELL STYLES  ─────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.page,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  content: { flex: 1 },
  rail: {
    width: layout.railWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  railBrand: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  railItems: { gap: spacing.xs },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
  },
  railItemActive: { backgroundColor: colors.accentMuted },
});