/**
 * BottomSheet.
 *
 * The single bottom-sheet implementation. DESIGN.md §24/§28 uses sheets for
 * wallet selection, asset selection, filters, quick actions, transaction
 * review, confirmation and secondary details — all of them render this
 * component rather than building their own overlay.
 *
 * Implemented on React Native's core `Modal` + `Animated` so it carries no
 * extra native dependency, and its geometry comes entirely from the design
 * tokens.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { colors, duration, elevation, radii, spacing } from '@/design/tokens';
import { IconButton, Row } from '@/components/primitives';
import { Text } from '@/components/primitives/Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Disables the drag-to-dismiss gesture (destructive flows). */
  dismissible?: boolean;
  /** Caps the sheet height as a fraction of the screen. */
  maxHeightRatio?: number;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  testID?: string;
};

const DRAG_DISMISS_DISTANCE = 110;

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  dismissible = true,
  maxHeightRatio = 0.86,
  contentStyle,
  footer,
  testID,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const maxHeight = height * maxHeightRatio;

  const animateOut = useCallback(
    (then: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: duration.fast,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: duration.fast,
          useNativeDriver: true,
        }),
      ]).start(() => then());
    },
    [backdrop, height, translateY],
  );

  const close = useCallback(() => {
    if (!dismissible) return;
    animateOut(onClose);
  }, [animateOut, dismissible, onClose]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(height);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 240,
          mass: 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: duration.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [backdrop, height, translateY, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          dismissible && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > DRAG_DISMISS_DISTANCE) {
            close();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 24,
              stiffness: 260,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [close, dismissible, translateY],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
      testID={testID}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={close}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            elevation.sheet,
            {
              maxHeight,
              paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.xl,
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.grabArea}>
            <View style={styles.grabber} />
            {title ? (
              <Row justify="space-between" align="center" style={styles.header}>
                <View style={styles.headerText}>
                  <Text variant="h3">{title}</Text>
                  {subtitle ? (
                    <Text variant="caption" tone="muted" numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {dismissible ? (
                  <IconButton
                    accessibilityLabel="Close"
                    onPress={close}
                    tone="muted"
                    style={styles.closeButton}
                  >
                    <X size={18} color={colors.textSecondary} />
                  </IconButton>
                ) : null}
              </Row>
            ) : null}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={[styles.bodyContent, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  grabArea: { paddingTop: spacing.md },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xl,
  },
  headerText: { flex: 1, gap: spacing.xxs },
  closeButton: { marginRight: -spacing.md },
  body: { flexGrow: 0 },
  bodyContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
});