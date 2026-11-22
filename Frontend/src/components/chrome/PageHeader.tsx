/**
 * PageHeader + Breadcrumbs.
 *
 * The App Bar already communicates *where you are*; this is the in-page
 * title block: title, optional subtitle, and optional actions. DESIGN.md
 * §11/§22 — the breadcrumb trail always starts at SOLANA VAULT, so a deep
 * screen reads SOLANA VAULT / WALLETS / PRIMARY CUSTODY.
 */

import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { colors, spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Row, Stack } from '@/components/primitives';
import type { Crumb } from './shell-context';

/* ───────────────────────────  BREADCRUMBS  ─────────────────────────── */

export const PRODUCT_NAME = 'SOLANA VAULT';

export function Breadcrumbs({
  crumbs,
  style,
}: {
  crumbs: Crumb[];
  style?: StyleProp<ViewStyle>;
}) {
  if (crumbs.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={styles.crumbContent}
    >
      <Row gap={spacing.xs}>
        {/* The product root is always the first crumb. */}
        <Text variant="overline" tone="muted" numberOfLines={1}>
          {PRODUCT_NAME}
        </Text>
        {crumbs.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${index}`}>
            <ChevronRight size={11} color={colors.textMuted} />
            <Text
              variant="overline"
              tone={index === crumbs.length - 1 ? 'secondary' : 'muted'}
              numberOfLines={1}
            >
              {crumb.label}
            </Text>
          </Fragment>
        ))}
      </Row>
    </ScrollView>
  );
}

/** Clickable breadcrumb variant for the Menu / All Tabs surfaces. */
export function BreadcrumbLinks({
  crumbs,
  onNavigate,
}: {
  crumbs: Crumb[];
  onNavigate: (href: string) => void;
}) {
  return (
    <Row gap={spacing.xs} wrap>
      {crumbs.map((crumb, index) => (
        <Fragment key={`${crumb.label}-${index}`}>
          {index > 0 ? (
            <ChevronRight size={11} color={colors.textMuted} />
          ) : null}
          {crumb.href ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Go to ${crumb.label}`}
              hitSlop={8}
              onPress={() => onNavigate(crumb.href as string)}
            >
              <Text variant="overline" tone="accent">
                {crumb.label}
              </Text>
            </Pressable>
          ) : (
            <Text variant="overline" tone="secondary">
              {crumb.label}
            </Text>
          )}
        </Fragment>
      ))}
    </Row>
  );
}

/* ────────────────────────────  PAGE HEADER  ──────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  detail,
  actions,
  badges,
  style,
  testID,
}: {
  title: string;
  subtitle?: string;
  /** Secondary technical line, rendered monospaced. */
  detail?: string;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Stack gap={spacing.md} style={style}>
      <Row justify="space-between" align="flex-start" gap={spacing.lg}>
        <View style={styles.headerText}>
          <Text variant="h1" numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" tone="secondary">
              {subtitle}
            </Text>
          ) : null}
          {detail ? (
            <Text variant="monoSmall" tone="muted" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        {actions ? (
          <Row gap={spacing.md} align="center">
            {actions}
          </Row>
        ) : null}
      </Row>
      {badges ? <Row gap={spacing.sm} wrap>{badges}</Row> : null}
    </Stack>
  );
}

/* ────────────────────────  SECTION HEADER  ──────────────────────── */

export function SectionHeader({
  title,
  subtitle,
  action,
  style,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row justify="space-between" align="center" gap={spacing.lg} style={style}>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="overline" tone="muted">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </Row>
  );
}

const styles = StyleSheet.create({
  crumbContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  headerText: { flex: 1, gap: spacing.xs },
});