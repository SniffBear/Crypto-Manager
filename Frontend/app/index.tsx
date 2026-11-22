/**
 * `/` — the entry point.
 *
 * The session gate in `app/_layout.tsx` owns the redirect decision, so this
 * screen has no content of its own. It exists to give expo-router a concrete
 * `/` route and to hold the screen while the vault state is being resolved.
 */

import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native';

import { colors } from '@/design/tokens';
import { routes } from '@/navigation/config';
import { useAuthStore } from '@/stores/auth';

export default function Index() {
  const phase = useAuthStore((s) => s.phase);

  if (phase === 'offline') return <Redirect href={routes.offline as never} />;
  if (phase === 'needs_setup') return <Redirect href={routes.setup as never} />;
  if (phase === 'locked') return <Redirect href={routes.unlock as never} />;
  if (phase === 'unlocked') return <Redirect href={routes.vault as never} />;

  return (
    <View style={styles.holder}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  holder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
});