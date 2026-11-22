/**
 * AlertIndicator — the single unread-alert control, rendered inside the
 * GlobalAppBar (DESIGN.md §21).
 *
 * Shows the unread count and escalates to a critical treatment when any
 * unread alert is critical. Tapping navigates to the Alert Center. There are
 * no page-specific variants.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Bell, ShieldAlert } from 'lucide-react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { useAlerts, useUnreadAlertCount } from '@/hooks/useApi';
import { routes } from '@/navigation/config';

export function AlertIndicator({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const count = useUnreadAlertCount();
  // Only the unread set is needed for severity; no extra request.
  const unread = useAlerts(true);
  const unreadCount = count.data ?? 0;
  const hasCritical = (unread.data ?? []).some((alert) => alert.level === 'critical');

  const background = hasCritical ? colors.dangerMuted : 'transparent';
  const iconColor = hasCritical ? colors.danger : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Alerts, ${unreadCount} unread${hasCritical ? ', critical alert present' : ''}`
          : 'Alerts, none unread'
      }
      onPress={() => router.push(routes.alerts as never)}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.surfaceHover : background },
        hasCritical ? styles.buttonCritical : null,
        style,
      ]}
    >
      {hasCritical ? (
        <ShieldAlert size={20} color={iconColor} />
      ) : (
        <Bell size={20} color={iconColor} />
      )}

      {unreadCount > 0 ? (
        <View
          style={[styles.count, hasCritical ? styles.countCritical : null]}
          accessibilityElementsHidden
        >
          <Text
            variant="monoSmall"
            style={[
              styles.countText,
              { color: hasCritical ? colors.danger : colors.accent },
            ]}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
  },
  buttonCritical: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.danger,
  },
  count: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countCritical: {
    backgroundColor: colors.surface,
  },
  countText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
});