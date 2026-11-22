/**
 * PageContainer — the single content container.
 *
 * DESIGN.md §10 (surfaces) and §18 (crowding, HIGH PRIORITY): horizontal
 * padding, top/bottom spacing, content width, safe-area handling, scroll
 * behaviour and section rhythm are all decided here so no page can invent
 * its own margins and no content ever touches the screen edge.
 *
 * It reads the active page meta from the shell, which means a screen opts
 * into scroll/inset behaviour by declaring it once.
 */

import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, spacing } from '@/design/tokens';
import { useConstrainedLayout } from '@/hooks/useResponsive';
import { useShellMeta } from './useShellMeta';

export type PageContainerProps = {
  children: React.ReactNode;
  /** Overrides the meta-declared scroll behaviour. */
  scrollable?: boolean;
  /** Extra space below the last child (e.g. above a sticky action bar). */
  bottomInset?: number;
  /** Removes the default vertical gap between direct children. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PageContainer({
  children,
  scrollable,
  bottomInset,
  gap = spacing.xxl,
  style,
  contentStyle,
  testID,
}: PageContainerProps) {
  const insets = useSafeAreaInsets();
  const meta = useShellMeta();
  const constrained = useConstrainedLayout();

  const shouldScroll = scrollable ?? meta?.scrollable ?? true;
  const extraBottom = bottomInset ?? meta?.bottomInset ?? 0;
  const horizontal = constrained ? layout.pagePaddingWide : layout.pagePadding;

  const padding = {
    paddingHorizontal: horizontal,
    // The bottom navigation occupies the space below the safe area.
    paddingBottom: layout.contentBottomInset + extraBottom,
  };

  const columnStyle: StyleProp<ViewStyle> = [
    styles.column,
    { gap },
    contentStyle,
  ];

  if (!shouldScroll) {
    return (
      <View
        testID={testID}
        style={[
          styles.root,
          { paddingTop: insets.top > 0 ? 0 : spacing.sm },
          style,
        ]}
      >
        <View
          style={[
            styles.inner,
            constrained ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' } : null,
            padding,
          ]}
        >
          <View style={columnStyle}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      testID={testID}
      style={[styles.root, style]}
      contentContainerStyle={[
        styles.inner,
        constrained
          ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
          : null,
        padding,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Never let a bounce reveal the bare page background.
      alwaysBounceVertical={false}
    >
      <View style={columnStyle}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  inner: { flexGrow: 1 },
  column: { paddingTop: spacing.lg },
});