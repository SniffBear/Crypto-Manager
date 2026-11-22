/**
 * MENU — the fourth and last primary destination.
 *
 * The menu is not a screen in the usual sense: `GlobalMenu` is the same
 * component the App Bar's menu affordance raises as a sheet, and `AllTabs` is
 * the same component Vault home offers. Rendering them here gives the Menu
 * destination a full page without forking either component into a
 * menu-specific variant (DESIGN.md §11).
 *
 * The capability table at the foot is the honest bottom line of the refactor:
 * every destination the backend does not implement is listed with the reason,
 * so nothing in the menu is a promise the API cannot keep.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { GlobalMenu } from '@/components/chrome/GlobalMenu';
import { AllTabs } from '@/components/chrome/AllTabs';
import { SearchBar } from '@/components/data';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { BACKEND_CAPABILITIES, type Availability } from '@/navigation/config';

type CapabilityRow = { name: string; availability: Availability };

const CAPABILITY_COLUMNS = {
  name: 260,
  state: 160,
} as const;

export default function MenuScreen() {
  const [query, setQuery] = useState('');

  usePageMeta({
    title: 'Menu',
    subtitle: 'Every remaining section of SOLANA VAULT',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Menu' }],
  });

  const capabilities = useMemo<CapabilityRow[]>(
    () =>
      (Object.entries(BACKEND_CAPABILITIES) as [string, Availability][])
        .map(([name, availability]) => ({ name, availability }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const notLive = capabilities.filter((row) => row.availability !== 'live');

  const columns: Column<CapabilityRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Capability',
        width: CAPABILITY_COLUMNS.name,
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <Text variant="monoSmall" numberOfLines={1}>
            {row.name}
          </Text>
        ),
      },
      {
        key: 'availability',
        header: 'State',
        width: CAPABILITY_COLUMNS.state,
        sortable: true,
        sortValue: (row) => row.availability,
        render: (row) => (
          <StatusBadge status={row.availability === 'live' ? 'ok' : row.availability} size="sm" />
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Menu"
          subtitle="Six sections, every destination, and the true state of each one."
        />

        <GlobalMenu />

        <View>
          <SectionHeader
            title="All screens"
            subtitle="Complete index of the information architecture"
          />
          <View style={{ marginTop: spacing.md }}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Filter every screen"
            />
          </View>
          <View style={{ marginTop: spacing.lg }}>
            <AllTabs query={query} showPrimary />
          </View>
        </View>

        <View>
          <SectionHeader
            title="Backend capability"
            subtitle={`${capabilities.length} declared · ${notLive.length} not fully live`}
          />
          <View style={{ marginTop: spacing.md }}>
            <DataTable
              columns={columns}
              data={notLive}
              getRowKey={(row) => row.name}
              emptyTitle="Every capability is live"
              emptyHint="Nothing in the information architecture depends on an unimplemented endpoint."
              caption="Unavailable and partial capabilities"
              initialSort={{ key: 'name', direction: 'asc' }}
            />
          </View>
        </View>
      </Stack>
    </PageContainer>
  );
}