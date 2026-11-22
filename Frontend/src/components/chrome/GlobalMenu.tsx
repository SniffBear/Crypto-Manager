/**
 * GlobalMenu — the canonical menu.
 *
 * Six sections, in the order fixed by the refactor contract:
 *   VAULT & SECURITY · ASSETS & RESEARCH · MONITORING · SERVICES ·
 *   ACCOUNTING · SYSTEM
 *
 * Every section the mockups implied exists here, and every entry is declared
 * with its real backend availability. Entries the backend does not implement
 * are rendered as explicit, navigable unavailable states with the reason
 * stated — DESIGN.md §1 forbids both hiding them and faking them.
 *
 * The menu also owns the two controls that are global by nature: the wallet
 * context and the lock action.
 */

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Lock, Search as SearchIcon, X } from 'lucide-react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Input, Row, Stack } from '@/components/primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { Icon } from '@/components/Icon';
import { WalletSelector, useSelectedWallet } from '@/components/context/WalletSelector';
import { useAuthStore } from '@/stores/auth';
import { useConfirmDialog } from '@/components/feedback/confirmation-context';
import { MENU_SECTIONS, PRIMARY_DESTINATIONS } from '@/navigation/config';

export function GlobalMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const { selected } = useSelectedWallet();
  const vault = useAuthStore((s) => s.vault);
  const lock = useAuthStore((s) => s.lock);
  const busy = useAuthStore((s) => s.busy);
  const { confirm } = useConfirmDialog();

  const needle = query.trim().toLowerCase();

  const sections = useMemo(
    () =>
      MENU_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            !needle ||
            item.label.toLowerCase().includes(needle) ||
            section.title.toLowerCase().includes(needle) ||
            (item.detail ?? '').toLowerCase().includes(needle),
        ),
      })).filter((section) => section.items.length > 0),
    [needle],
  );

  const navigate = (href: string) => {
    if (pathname === href) return;
    router.push(href as never);
  };

  const onLock = async () => {
    const confirmed = await confirm({
      title: 'Lock the vault?',
      message:
        'The session token is discarded from memory and every screen is cleared until you unlock again.',
      confirmLabel: 'Lock vault',
      tone: 'danger',
    });
    if (confirmed) await lock();
  };

  return (
    <Stack gap={spacing.xxl}>
      {/* ── Session + wallet context ───────────────────────────── */}
      <Card variant="elevated" style={styles.contextCard}>
        <Row justify="space-between" align="center" gap={spacing.lg}>
          <Text variant="overline" tone="muted">
            Vault
          </Text>
          <StatusBadge status={vault?.locked ? 'vault locked' : 'vault unlocked'} />
        </Row>

        <View style={styles.contextBody}>
          <WalletSelector variant="inline" />
        </View>

        <Row justify="space-between" align="center" gap={spacing.lg} wrap>
          <Text variant="caption" tone="muted" style={styles.contextNote}>
            {selected
              ? 'Portfolio, assets, activity, alerts, risk and accounting are scoped to this wallet.'
              : 'Portfolio, assets, activity, alerts, risk and accounting aggregate every wallet.'}
          </Text>
          <Button
            label="Lock vault"
            variant="secondary"
            size="sm"
            icon={<Lock size={15} color={colors.textSecondary} />}
            loading={busy}
            onPress={() => void onLock()}
          />
        </Row>
      </Card>

      {/* ── Primary destinations ────────────────────────────────── */}
      <View style={styles.group}>
        <Text variant="overline" tone="muted">
          Primary
        </Text>
        <Row gap={spacing.md} wrap>
          {PRIMARY_DESTINATIONS.filter((d) => d.key !== 'menu').map((destination) => (
            <Pressable
              key={destination.key}
              accessibilityRole="button"
              accessibilityLabel={destination.label}
              onPress={() => navigate(destination.href)}
              style={({ pressed }) => [
                styles.quickTile,
                pathname === destination.href ? styles.quickTileActive : null,
                pressed ? { backgroundColor: colors.surfaceHover } : null,
              ]}
            >
              <Icon name={destination.icon} size={20} color={colors.accent} />
              <Text variant="label">{destination.label}</Text>
            </Pressable>
          ))}
        </Row>
      </View>

      {/* ── Filter ──────────────────────────────────────────────── */}
      <Input
        label="Filter menu"
        placeholder="Search every section…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        right={
          query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear filter"
              hitSlop={10}
              onPress={() => setQuery('')}
            >
              <X size={16} color={colors.textMuted} />
            </Pressable>
          ) : (
            <SearchIcon size={16} color={colors.textMuted} />
          )
        }
      />

      {/* ── Sections ────────────────────────────────────────────── */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" tone="secondary" align="center">
            Nothing in the menu matches “{query}”.
          </Text>
          <Text variant="caption" tone="muted" align="center">
            Use the Search screen to look across destinations and content.
          </Text>
        </View>
      ) : (
        sections.map((section) => (
          <View key={section.title} style={styles.group}>
            <Text variant="overline" tone="muted" style={styles.groupTitle}>
              {section.title}
            </Text>
            <View style={styles.list}>
              {section.items.map((item) => (
                <Pressable
                  key={`${section.title}-${item.label}`}
                  accessibilityRole="link"
                  accessibilityLabel={
                    item.availability === 'live'
                      ? item.label
                      : `${item.label}, ${item.availability}`
                  }
                  testID={`menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onPress={() => navigate(item.href)}
                  style={({ pressed }) => [
                    styles.row,
                    pathname === item.href ? styles.rowActive : null,
                    pressed ? { backgroundColor: colors.surfaceHover } : null,
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <Icon name={item.icon} size={18} color={colors.textSecondary} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text variant="body" numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.detail ? (
                      <Text variant="caption" tone="muted" numberOfLines={2}>
                        {item.detail}
                      </Text>
                    ) : null}
                  </View>
                  {item.availability !== 'live' ? (
                    <StatusBadge status={item.availability} size="sm" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))
      )}
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
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  rowActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  rowIcon: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, gap: spacing.xxs },
  quickTile: {
    minWidth: 108,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  quickTileActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  contextCard: { gap: spacing.lg },
  contextBody: { marginHorizontal: -spacing.xl, marginVertical: -spacing.lg },
  contextNote: { flexShrink: 1, flexGrow: 1, minWidth: 180 },
  empty: { paddingVertical: spacing.vast, paddingHorizontal: spacing.xl, gap: spacing.sm },
});