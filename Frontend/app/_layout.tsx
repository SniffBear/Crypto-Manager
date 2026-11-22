/**
 * Root layout — providers, theme and the session gate.
 *
 * This is the only place the application decides *which* experience the user
 * gets. Everything below it is presentation.
 *
 *   SafeAreaProvider
 *   └─ QueryClientProvider          one cache, one refetch policy
 *      └─ ShellProvider            the single sheet host
 *         └─ ConfirmationProvider  the single confirmation host
 *            └─ Stack               the session gate decides what renders
 *
 * DESIGN.md §36 — the session token lives in memory only. Nothing here
 * persists it, and locking the vault drops it (see `stores/auth.ts`).
 */

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/design/tokens';
import { ShellProvider } from '@/components/chrome/shell-context';
import { ConfirmationProvider } from '@/components/feedback/confirmation-context';
import { ToastHost } from '@/components/feedback/Toast';
import { setUnauthorizedHandler } from '@/api/client';
import { useAuthStore, type AuthPhase } from '@/stores/auth';
import { routes } from '@/navigation/config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // DESIGN.md §41 — no screen may show a spinner on every focus.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

/** Where each settled phase belongs. `booting` has no destination yet. */
const PHASE_HOME: Record<Exclude<AuthPhase, 'booting' | 'offline'>, string> = {
  needs_setup: routes.setup,
  locked: routes.unlock,
  unlocked: routes.vault,
};

const AUTH_SCREENS: string[] = [routes.setup, routes.unlock, routes.offline];

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ShellProvider>
          <ConfirmationProvider>
            <View style={styles.root}>
              <StatusBar style="light" />
              <SessionGate>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.page },
                    animation: 'fade',
                  }}
                />
              </SessionGate>
              <ToastHost />
            </View>
          </ConfirmationProvider>
        </ShellProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * The gate.
 *
 * It owns exactly one rule: a screen that requires a session must never
 * render without one, and a locked vault must never show authenticated
 * content. It does not render anything itself — it redirects.
 */
function SessionGate({ children }: { children: React.ReactNode }) {
  const phase = useAuthStore((s) => s.phase);
  const router = useRouter();
  const pathname = usePathname();
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void useAuthStore
      .getState()
      .bootstrap()
      .finally(() => {
        if (!cancelled) setBooted(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 anywhere in the app ends the session (see api/client.ts).
  useEffect(() => {
    setUnauthorizedHandler(() => useAuthStore.getState().handleUnauthorized());
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!booted || phase === 'booting') return;

    if (phase === 'offline') {
      if (pathname !== routes.offline) router.replace(routes.offline as never);
      return;
    }

    const target = PHASE_HOME[phase];
    const onAuthScreen = AUTH_SCREENS.includes(pathname);

    if (phase === 'unlocked') {
      // Setup/unlock/offline are meaningless once a session exists.
      if (onAuthScreen) router.replace(target as never);
      return;
    }

    // Locked or uninitialised: only the matching auth screen may render.
    if (onAuthScreen && pathname === target) return;
    router.replace(target as never);
  }, [booted, phase, pathname, router]);

  return children;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
});