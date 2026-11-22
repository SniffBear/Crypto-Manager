/**
 * UNAVAILABLE FEATURE — one route for every destination the backend lacks.
 *
 * The 61 mockups shipped an address book, a token screener, wallet
 * intelligence, developer intelligence, a signature index and manual sync
 * control as if they existed. The backend implements none of them.
 * DESIGN.md §1 forbids both faking them and hiding them, so they stay
 * reachable, stay listed, and land here: a named reason, the specific missing
 * capability, and a route back to something that does work.
 *
 * A feature key with no entry in `UNAVAILABLE_FEATURES` is itself reported as
 * unknown rather than rendering as a blank page.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { StatusBadge } from '@/components/StatusBadge';
import { ListRow } from '@/components/data';
import { EmptyState, UnsupportedState } from '@/components/feedback/states';
import { routes, UNAVAILABLE_FEATURES } from '@/navigation/config';
import { titleCase } from '@/utils/format';

export default function UnavailableFeatureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ feature: string | string[] }>();
  const raw = Array.isArray(params.feature) ? params.feature[0] : params.feature;
  const feature = raw?.trim().toLowerCase() ?? '';
  const entry = UNAVAILABLE_FEATURES[feature];

  usePageMeta({
    title: entry?.title ?? titleCase(feature),
    subtitle: 'Not implemented by the backend',
    breadcrumbs: [{ label: 'Unavailable' }],
  });

  if (!feature) {
    return (
      <PageContainer>
        <EmptyState
          title="No feature requested"
          hint="This route needs a feature key. Open the menu to pick a destination."
          actionLabel="Open menu"
          onAction={() => router.replace(routes.menu as never)}
        />
      </PageContainer>
    );
  }

  if (!entry) {
    return (
      <PageContainer>
        <Stack gap={spacing.xxl}>
          <PageHeader
            title={titleCase(feature)}
            subtitle="This destination is not part of the information architecture."
          />
          <UnsupportedState
            title="Unknown destination"
            reason="Nothing in SOLANA VAULT is registered under this name."
            detail="This route exists so an unrecognised link fails explicitly instead of rendering an empty page. Open the menu to see every real destination."
          />
          <Button
            label="Open menu"
            variant="secondary"
            onPress={() => router.replace(routes.menu as never)}
          />
        </Stack>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title={entry.title}
          subtitle="This destination is declared, and the backend does not implement it."
          badges={
            <>
              <StatusBadge status="unavailable" />
              <StatusBadge status="solana mainnet" size="sm" />
            </>
          }
        />

        <UnsupportedState
          title={entry.reason}
          reason="No screen is shown here rather than presenting fabricated or empty data as a working feature."
          detail={entry.backendNote}
        />

        {/* ── Why it stays reachable ─────────────────────────────── */}
        <View>
          <SectionHeader
            title="Why this is still reachable"
            subtitle="A declared destination is never hidden from the navigation"
          />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Text variant="body" tone="secondary">
                Hiding a destination makes the gap invisible — the section simply looks like it was
                never designed. Declaring it, and naming the exact capability that is missing, keeps
                the information architecture honest and gives the backend somewhere to land it.
              </Text>
              <Text variant="caption" tone="muted">
                Solana only. Nothing here implies a second chain, a remote service or a different
                trust model.
              </Text>
            </Stack>
          </Card>
        </View>

        {/* ── Related live destinations ──────────────────────────── */}
        <View>
          <SectionHeader
            title="What does work"
            subtitle="Live destinations closest to this one"
          />
          <Card padded={false} style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.sm} style={styles.listPad}>
              <ListRow
                title="Vault home"
                subtitle="Portfolio, attention and recent activity"
                onPress={() => router.push(routes.vault as never)}
              />
              <ListRow
                title="All screens"
                subtitle="Every destination, including this one"
                onPress={() => router.push(routes.allTabs as never)}
              />
              <ListRow
                title="Menu"
                subtitle="The six canonical sections"
                onPress={() => router.push(routes.menu as never)}
              />
            </Stack>
          </Card>
        </View>

        <Row gap={spacing.md} wrap>
          <Button
            label="Back to menu"
            variant="secondary"
            onPress={() => router.replace(routes.menu as never)}
          />
          <Button
            label="All screens"
            variant="tertiary"
            onPress={() => router.replace(routes.allTabs as never)}
          />
        </Row>
      </Stack>
    </PageContainer>
  );
}

const styles = {
  listPad: { padding: spacing.lg },
} as const;