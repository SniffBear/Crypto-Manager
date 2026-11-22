/**
 * ALL SCREENS — the full index of the application.
 *
 * Reachable from the Vault home sheet and the Menu, but given its own route
 * because the 61 mockups scattered whole sections across ten navigation
 * schemes. Nothing here is a dead end: `AllTabs` is generated from
 * `navigation/config.ts`, so every entry resolves to a real route, and the
 * entries the backend does not implement resolve to an explicit unavailable
 * state rather than to nothing.
 */

import { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { AllTabs, buildTabGroups } from '@/components/chrome/AllTabs';
import { SearchBar } from '@/components/data';

export default function AllScreensScreen() {
  const [query, setQuery] = useState('');
  const total = buildTabGroups().reduce((sum, group) => sum + group.items.length, 0);

  usePageMeta({
    title: 'All screens',
    subtitle: 'Every destination in SOLANA VAULT',
    breadcrumbs: [{ label: 'All screens' }],
  });

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="All screens"
          subtitle={`${total} destinations, generated from the information architecture so none can go missing.`}
        />

        <View>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Filter destinations"
          />
        </View>

        <AllTabs query={query} showPrimary />
      </Stack>
    </PageContainer>
  );
}