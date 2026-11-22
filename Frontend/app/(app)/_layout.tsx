/**
 * The authenticated shell.
 *
 * `AppShell` is mounted once, here. Every screen beneath it renders content
 * only — it declares its identity with `usePageMeta` and its body with
 * `PageContainer`. There is no second App Bar, no second bottom navigation
 * and no per-screen header in the entire application.
 */

import { Stack } from 'expo-router';

import { colors } from '@/design/tokens';
import { AppShell } from '@/components/chrome/AppShell';

export default function AppGroupLayout() {
  return (
    <AppShell>
      <Stack
        screenOptions={{
          // The shell owns all chrome.
          headerShown: false,
          contentStyle: { backgroundColor: colors.page },
          animation: 'fade',
        }}
      />
    </AppShell>
  );
}