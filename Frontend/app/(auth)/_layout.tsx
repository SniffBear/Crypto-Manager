/**
 * Authenticated screens: setup, unlock, offline.
 *
 * These deliberately have no App Bar and no bottom navigation — the product
 * chrome belongs to the unlocked application. What they share is a layout:
 * one centred column, generous gutters, and a status panel that explains the
 * vault's actual cryptographic state rather than a marketing hero.
 */

import { Stack } from 'expo-router';

import { colors } from '@/design/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.page },
        animation: 'fade',
      }}
    />
  );
}