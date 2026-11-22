/**
 * Data display components: metrics, tabs, search, filters, list rows.
 *
 * These are the remaining pieces of the shared component library required
 * by the refactor contract. Screens compose them; they never re-declare
 * their own equivalents.
 */

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react-native';

import { colors, layout, radii, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Card, Chip, Input, Row, Stack, type Tone } from '@/components/primitives';

/* ═══════════════════════════  METRIC CARD  ═══════════════════════════ */

/**
 * A single headline number. DESIGN.md §18 — fewer simultaneous metrics, so
 * this is deliberately one value + one label (+ optional trend), not a
 * four-stat dashboard tile.
 */
export function MetricCard({
  label,
  value,
  sublabel,
  trend,
  trendTone,
  tone = 'neutral',
  icon,
  onPress,
  style,
  testID,
}: {
  label: string;
  value: string;
  sublabel?: string;
  trend?: string;
  trendTone?: Tone;
  tone?: Tone;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const body = (
    <Stack gap={spacing.md}>
      <Row justify="space-between" align="center" gap={spacing.md}>
        <Text variant="overline" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
        {icon}
        {onPress ? <ChevronRight size={15} color={colors.textMuted} /> : null}
      </Row>
      <Text variant="monoLarge" numberOfLines={1} testID={testID}>
        {value}
      </Text>
      <Row gap={spacing.md}>
        {trend ? (
          <Text variant="monoSmall" tone={trendTone ?? 'muted'}>
            {trend}
          </Text>
        ) : null}
        {sublabel ? (
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {sublabel}
          </Text>
        ) : null}
      </Row>
    </Stack>
  );

  const toneBorder =
    tone === 'danger'
      ? colors.danger
      : tone === 'warning'
        ? colors.warning
        : tone === 'success'
          ? colors.success
          : tone === 'stale'
            ? colors.stale
            : colors.border;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.metric,
          { borderColor: toneBorder },
          pressed ? { backgroundColor: colors.surfaceHover } : null,
          style,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={[styles.metric, { borderColor: toneBorder }, style]}>{body}</View>
  );
}

/* ══════════════════════════════  TABS  ══════════════════════════════ */

/**
 * DESIGN.md §3.6/§21 — secondary information belongs behind tabs. This is
 * the single tab control used everywhere.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  style,
  scrollable = true,
}: {
  tabs: { key: string; label: string; badge?: number }[];
  active: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  scrollable?: boolean;
}) {
  const content = (
    <Row gap={spacing.xs} style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.tabActive : null,
              pressed && !isActive ? { backgroundColor: colors.surfaceHover } : null,
            ]}
          >
            <Text variant="label" tone={isActive ? 'accent' : 'secondary'} numberOfLines={1}>
              {tab.label}
            </Text>
            {typeof tab.badge === 'number' && tab.badge > 0 ? (
              <View style={styles.tabBadge}>
                <Text variant="monoSmall" tone="accent">
                  {tab.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </Row>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl }}
        style={[styles.tabScroll, style]}
      >
        {content}
      </ScrollView>
    );
  }
  return <View style={style}>{content}</View>;
}

/* ═══════════════════════════  SEARCH BAR  ═══════════════════════════ */

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmit,
  autoFocus = false,
  style,
  testID,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Input
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      onSubmitEditing={onSubmit}
      accessibilityLabel={placeholder}
      style={style}
      right={
        value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
            onPress={() => onChangeText('')}
          >
            <X size={16} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Search size={16} color={colors.textMuted} />
        )
      }
    />
  );
}

/* ═══════════════════════════  FILTER BAR  ═══════════════════════════ */

export type FilterGroup = {
  key: string;
  label: string;
  options: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
};

/**
 * Filters sit above the table (DESIGN.md §29). Horizontally scrollable so a
 * long filter set never compresses the rows beneath it.
 */
export function FilterBar({
  groups,
  onClear,
  activeCount,
  style,
}: {
  groups: FilterGroup[];
  onClear?: () => void;
  activeCount?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterContent}
      style={style}
    >
      <Row gap={spacing.sm}>
        {groups.map((group) => (
          <Row key={group.key} gap={spacing.sm}>
            <Text variant="overline" tone="muted">
              {group.label}
            </Text>
            {group.options.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                count={option.count}
                selected={group.value === option.key}
                onPress={() => group.onChange(option.key)}
              />
            ))}
          </Row>
        ))}
        {onClear && activeCount ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            onPress={onClear}
            hitSlop={8}
            style={styles.clearFilters}
          >
            <Text variant="label" tone="accent">
              Clear ({activeCount})
            </Text>
          </Pressable>
        ) : null}
      </Row>
    </ScrollView>
  );
}

/** Button that opens the filter sheet — used above tables on small screens. */
export function FilterButton({
  activeCount,
  onPress,
  label = 'Filters',
}: {
  activeCount: number;
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        activeCount > 0 ? `${label}, ${activeCount} active` : label
      }
      onPress={onPress}
      style={({ pressed }) => [styles.filterButton, pressed ? { backgroundColor: colors.surfaceHover } : null]}
    >
      <SlidersHorizontal size={15} color={activeCount > 0 ? colors.accent : colors.textSecondary} />
      <Text variant="label" tone={activeCount > 0 ? 'accent' : 'secondary'}>
        {label}
      </Text>
      {activeCount > 0 ? (
        <View style={styles.filterCount}>
          <Text variant="monoSmall" tone="accent">
            {activeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ═══════════════════════════  LIST ROW  ═══════════════════════════ */

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  meta,
  badges,
  onPress,
  selected = false,
  style,
  testID,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Technical line, rendered monospaced. */
  meta?: string;
  badges?: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const content = (
    <Row gap={spacing.lg} align="center" style={styles.rowInner}>
      {leading}
      <View style={styles.rowBody}>
        <Row justify="space-between" align="center" gap={spacing.md}>
          <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          {trailing}
        </Row>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="monoSmall" tone="muted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {badges ? <Row gap={spacing.sm} wrap style={{ marginTop: spacing.xs }}>{badges}</Row> : null}
      </View>
      {onPress ? <ChevronRight size={16} color={colors.textMuted} /> : null}
    </Row>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, selected ? styles.rowSelected : null, style]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.rowSelected : null,
        pressed ? { backgroundColor: colors.surfaceHover } : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

/* ═════════════════════  EXPANDABLE SECTION  ═════════════════════ */

/**
 * DESIGN.md §3.6/§24 — raw data, technical diagnostics and provider details
 * live behind an expandable rather than on the primary surface.
 */
export function ExpandableSection({
  title,
  subtitle,
  children,
  initiallyOpen = false,
  style,
  testID,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  initiallyOpen?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <Card style={style} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => setOpen((prev) => !prev)}
        style={({ pressed }) => [
          styles.expandableHeader,
          pressed ? { opacity: 0.7 } : null,
        ]}
      >
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="label">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {open ? (
          <ChevronDown size={16} color={colors.textMuted} />
        ) : (
          <ChevronRight size={16} color={colors.textMuted} />
        )}
      </Pressable>
      {open ? <View style={styles.expandableBody}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  metric: {
    padding: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tabScroll: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  tabBar: { paddingVertical: spacing.md, paddingRight: spacing.xl },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.control,
    minHeight: 38,
  },
  tabActive: {
    backgroundColor: colors.accentMuted,
  },
  tabBadge: {
    minWidth: 18,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  filterContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  filterCount: {
    minWidth: 18,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  clearFilters: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  row: {
    minHeight: layout.listRowHeight,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowSelected: { backgroundColor: colors.accentMuted },
  rowInner: { width: '100%' },
  rowBody: { flex: 1, gap: spacing.xxs },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  expandableBody: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
});