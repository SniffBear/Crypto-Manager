/**
 * DataTable — the single table implementation.
 *
 * DESIGN.md §29 (tables & data density) and §17 (tables & lists):
 * consistent row height, stable column widths, monospaced numerics, filters
 * above the table, horizontal scroll for genuinely wide tables, sortable
 * headings, and a virtualised body.
 *
 * DESIGN.md §18 is the counterweight: rows are a comfortable 52pt and type
 * never shrinks to fit more columns — wide tables scroll instead.
 */

import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react-native';

import { colors, layout, radii, spacing, type TypeVariant } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { EmptyState, ErrorState, SkeletonList } from '@/components/feedback/states';

export type Column<T> = {
  key: string;
  header: string;
  /** Fixed width in points. Required for stable columns. */
  width: number;
  align?: 'left' | 'right' | 'center';
  /** Force the monospaced numeric/technical face (DESIGN.md §8). */
  mono?: boolean;
  sortable?: boolean;
  /** Custom cell renderer. */
  render?: (row: T, index: number) => React.ReactNode;
  /** Value used for client-side sorting when `sortable`. */
  sortValue?: (row: T) => string | number;
};

export type SortState = { key: string; direction: 'asc' | 'desc' } | null;

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string;
  onRowPress?: (row: T) => void;
  selectedKey?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyHint?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /** Sticky caption rendered above the header row. */
  caption?: string;
  /** Initial sort applied on mount. */
  initialSort?: SortState;
  /** Enables pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Extra content rendered under the header (filter bar slot). */
  toolbar?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowPress,
  selectedKey = null,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'No data',
  emptyHint,
  emptyActionLabel,
  onEmptyAction,
  caption,
  initialSort = null,
  onRefresh,
  refreshing = false,
  toolbar,
  style,
  testID,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return data;
    const direction = sort.direction === 'asc' ? 1 : -1;
    // Copy before sorting so the caller's array is never mutated.
    return [...data].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    });
  }, [columns, data, sort]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  const renderHeader = () => (
    <View style={styles.headerRow}>
      {columns.map((column) => {
        const active = sort?.key === column.key;
        return (
          <Pressable
            key={column.key}
            accessibilityRole={column.sortable ? 'button' : 'text'}
            accessibilityLabel={
              column.sortable
                ? `${column.header}, ${active ? `sorted ${sort?.direction}` : 'not sorted'}`
                : column.header
            }
            disabled={!column.sortable}
            onPress={() => column.sortable && toggleSort(column.key)}
            style={[
              styles.headerCell,
              { width: column.width, justifyContent: alignToFlex(column.align) },
            ]}
          >
            <Text variant="overline" tone={active ? 'accent' : 'muted'} numberOfLines={1}>
              {column.header}
            </Text>
            {column.sortable ? (
              active ? (
                sort?.direction === 'asc' ? (
                  <ArrowUp size={11} color={colors.accent} />
                ) : (
                  <ArrowDown size={11} color={colors.accent} />
                )
              ) : (
                <ChevronsUpDown size={11} color={colors.textMuted} />
              )
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  const renderRow = ({ item, index }: { item: T; index: number }) => {
    const key = getRowKey(item, index);
    const isSelected = selectedKey === key;

    return (
      <Pressable
        accessibilityRole={onRowPress ? 'button' : 'text'}
        accessibilityState={{ selected: isSelected }}
        onPress={onRowPress ? () => onRowPress(item) : undefined}
        style={({ pressed }) => [
          styles.row,
          isSelected ? styles.rowSelected : null,
          pressed && onRowPress ? { backgroundColor: colors.surfaceHover } : null,
        ]}
      >
        {columns.map((column) => {
          const align = column.align ?? 'left';
          return (
            <View
              key={column.key}
              style={[
                styles.cell,
                { width: column.width, alignItems: alignToFlex(align) },
              ]}
            >
              {column.render ? (
                column.render(item, index)
              ) : (
                <CellValue row={item} column={column} />
              )}
            </View>
          );
        })}
      </Pressable>
    );
  };

  /* Loading / error / empty short-circuit the header so a broken panel never
   * renders a misleading column layout (DESIGN.md §30). */
  if (isLoading) {
    return (
      <View style={[styles.container, style]} testID={testID}>
        <SkeletonList count={6} lines={1} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, style]} testID={testID}>
        <ErrorState title="Could not load" message={error} onRetry={onRetry} />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={[styles.container, style]} testID={testID}>
        <EmptyState
          title={emptyTitle}
          hint={emptyHint}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          compact
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} testID={testID}>
      {caption ? (
        <Text variant="label" tone="secondary" style={styles.caption}>
          {caption}
        </Text>
      ) : null}

      {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalContent}
      >
        <View style={{ width: Math.max(totalWidth, 1) }}>
          {renderHeader()}
          <FlatList
            data={sorted}
            keyExtractor={getRowKey}
            renderItem={renderRow}
            // Virtualisation: only a small window of rows is ever mounted.
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews
            onRefresh={onRefresh}
            refreshing={refreshing}
            style={styles.body}
            nestedScrollEnabled
            scrollEnabled={Boolean(onRefresh)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function CellValue<T>({ row, column }: { row: T; column: Column<T> }) {
  const value = (row as Record<string, unknown>)[column.key];
  if (value === null || value === undefined || value === '') {
    return <Text variant="caption" tone="muted">—</Text>;
  }
  const variant: TypeVariant = column.mono ? 'monoSmall' : 'body';
  return (
    <Text variant={variant} numberOfLines={1} style={styles.cellText}>
      {String(value)}
    </Text>
  );
}

function alignToFlex(align: 'left' | 'right' | 'center' | undefined) {
  if (align === 'right') return 'flex-end';
  if (align === 'center') return 'center';
  return 'flex-start';
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  caption: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  toolbar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  horizontalContent: { paddingRight: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.tableHeaderHeight,
    paddingLeft: spacing.xl,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: colors.border,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  body: { backgroundColor: colors.surface },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.tableRowHeight,
    paddingLeft: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.accentMuted,
  },
  cell: {
    justifyContent: 'center',
    paddingRight: spacing.lg,
  },
  cellText: { flexShrink: 1 },
});

/**
 * ResponsiveTable — the same table, adapted for wide screens where the
 * horizontal scroll is unnecessary. Kept as a thin alias so there is still
 * exactly one table implementation (DESIGN.md §34: the information
 * architecture must not change per device).
 */
export const ResponsiveTable = DataTable;