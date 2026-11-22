/**
 * Modal — the single centred-dialog surface.
 *
 * DESIGN.md §24 reserves modals for destructive confirmations, sensitive
 * actions and security warnings; everything else belongs in a BottomSheet.
 */

import { Modal as RNModal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, radii, spacing } from '@/design/tokens';
import { Row } from '@/components/primitives';
import { Text } from '@/components/primitives/Text';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  dismissible = true,
  contentStyle,
  testID,
}: ModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissible ? onClose : undefined}
      statusBarTranslucent
      testID={testID}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
          onPress={dismissible ? onClose : undefined}
          disabled={!dismissible}
        />
        <View style={[styles.card, elevation.card, contentStyle]}>
          {title ? (
            <View style={styles.header}>
              <Text variant="h3">{title}</Text>
              {subtitle ? (
                <Text variant="body" tone="secondary">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <Row gap={spacing.md} style={styles.footer}>{footer}</Row> : null}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  header: { padding: spacing.xl, gap: spacing.sm },
  body: { maxHeight: 460 },
  bodyContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  footer: {
    padding: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
});