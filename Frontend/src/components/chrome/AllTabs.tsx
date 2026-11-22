/**
 * AllTabs — the complete index of every reachable destination.
 *
 * The 61 mockups scattered navigation across ten incompatible schemes, which
 * meant whole sections were reachable only if you happened to know the URL.
 * `AllTabs` closes that: it is generated from `navigation/config.ts`, so it
 * lists every destination in the information architecture, grouped, and
 * cannot fall out of sync with the Menu or the bottom navigation.
 *
 * Destinations the backend does not implement are listed but marked
 * UNAVAILABLE and route to the explicit unavailable state — they are never
 * hidden and never faked (DESIGN.md §1).
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Row, Stack } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { Icon } from '@/components/Icon';
import {
  activePrimaryKey,
  DESTINATION_CHILDREN,
  MENU_SECTIONS,
  PRIMARY_DESTINATIONS,
  type Availability,
  type PrimaryKey,
} from '@/navigation/config';

export type TabGroup = {
  title: string;
  items: {
    key: string;
    label: string;
    href: string;
    icon: string;
    availability: Availability;
    detail?: string;
  }[];
};

/**
 * Build the grouped index. Pure derivation from the IA config — no page
 * contributes a destination, and no destination is defined twice.
 */
export function buildTabGroups(): TabGroup[] {
  const groups: TabGroup[] = [
    {
      title: 'Primary',
      items: PRIMARY_DESTINATIONS.map((destination) => ({
        key: `primary-${destination.key}`,
        label: destination.label,
        href: destination.href,
        icon: destination.icon,
        availability: 'live' as Availability,
        detail: destination.description,
      })),
    },
  ];

  for (const destination of PRIMARY_DESTINATIONS) {
    const children = DESTINATION_CHILDREN[destination.key as PrimaryKey];
    if (!children || children.length === 0) continue;
    groups.push({
      title: `${destination.label} — In Section`,
      items: children.map((child, index) => ({
        key: `${destination.key}-child-${index}`,
        label: child.label,
        href: child.href,
        icon: destination.icon,
        availability: child.availability,
      })),
    });
  }

  for (const section of MENU_SECTIONS) {
    groups.push({
      title: section.title,
      items: section.items.map((item, index) => ({
        key: `${section.title}-${index}`,
        label: item.label,
        href: item.href,
        icon: item.icon,
        availability: item.availability,
        detail: item.detail,
      })),
    });
  }

  return groups;
}

export function AllTabs({
  query,
  showPrimary = false,
  onNavigate,
}: {
  /** Case-insensitive filter across label, group title and detail. */
  query?: string;
  /** Set false to hide the redundant "Primary" group (the bottom bar owns it). */
  showPrimary?: boolean;
  onNavigate?: (href: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const active = activePrimaryKey(pathname);

  const groups = useMemo(() => {
    const all = buildTabGroups().filter((group) => showPrimary || group.title !== 'Primary');
    const needle = query?.trim().toLowerCase() ?? '';
    if (!needle) return all;
    return all
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(needle) ||
            group.title.toLowerCase().includes(needle) ||
            (item.detail ?? '').toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, showPrimary]);

  const navigate = (href: string) => {
    if (onNavigate) return onNavigate(href);
    if (pathname === href) return;
    router.push(href as never);
  };

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="body" tone="secondary" align="center">
          No destination matches “{query}”.
        </Text>
        <Text variant="caption" tone="muted" align="center">
          Every screen in SOLANA VAULT is listed here — try a shorter term.
        </Text>
      </View>
    );
  }

  return (
    <Stack gap={spacing.xxl}>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text variant="overline" tone="muted" style={styles.groupTitle}>
            {group.title}
          </Text>
          <View style={styles.list}>
            {group.items.map((item) => {
              const isCurrent = item.href === pathname;
              const isActivePrimary =
                showPrimary && group.title === 'Primary'
                  ? PRIMARY_DESTINATIONS.find((d) => d.href === item.href)?.key === active
                  : false;

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: isCurrent }}
                  onPress={() => navigate(item.href)}
                  style={({ pressed }) => [
                    styles.row,
                    (isCurrent || isActivePrimary) ? styles.rowActive : null,
                    pressed ? { backgroundColor: colors.surfaceHover } : null,
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <Icon
                      name={item.icon}
                      size={18}
                      color={isCurrent || isActivePrimary ? colors.accent : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.rowBody}>
                    <Text
                      variant="body"
                      numberOfLines={1}
                      style={isCurrent || isActivePrimary ? { color: colors.accent } : null}
                    >
                      {item.label}
                    </Text>
                    {item.detail ? (
                      <Text variant="caption" tone="muted" numberOfLines={2}>
                        {item.detail}
                      </Text>
                    ) : null}
                  </View>
                  {item.availability !== 'live' ? (
                    <StatusBadge
                      status={item.availability === 'partial' ? 'partial' : 'unavailable'}
                      size="sm"
                    />
                  ) : null}
                  {item.availability === 'unavailable' ? (
                    <Lock size={13} color={colors.textMuted} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Stack>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  groupTitle: { paddingHorizontal: spacing.xs },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  rowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  rowIcon: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, gap: spacing.xxs },
  empty: {
    paddingVertical: spacing.vast,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
});