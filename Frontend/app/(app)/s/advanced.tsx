/**
 * ADVANCED / FUTURE — the register of what the backend does not do.
 *
 * The 61 mockups specified an address book, a token screener, wallet and
 * developer intelligence, a signature index, manual sync control, a settings
 * screen and a full trading terminal. The backend implements almost none of
 * it. DESIGN.md §1 forbids both faking those features and hiding them, so they
 * are declared, listed and reachable — and this screen is where the whole
 * register lives in one place.
 *
 * The table is generated from `BACKEND_CAPABILITIES`, the same map the Menu
 * and the unavailable-state route read, so a capability cannot be marked
 * partial in one place and live in another. `CAPABILITY_SCREENS` is typed
 * against that map's keys, which means adding a capability without deciding
 * where it surfaces is a compile error rather than a silent omission.
 *
 * The per-feature explanations below come from `UNAVAILABLE_FEATURES`, so the
 * specific missing endpoint is stated in the same words the destination itself
 * will show.
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { DataTable, type Column } from '@/components/DataTable';
import { ExpandableSection, FilterBar, MetricCard, type FilterGroup } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { NoticeBanner } from '@/components/feedback/states';
import {
  BACKEND_CAPABILITIES,
  routes,
  UNAVAILABLE_FEATURES,
  type Availability,
} from '@/navigation/config';

const COLUMNS = {
  capability: 224,
  status: 132,
  screen: 208,
  note: 320,
} as const;

const ALL = 'all';
type CapabilityKey = keyof typeof BACKEND_CAPABILITIES;

/**
 * Where each capability surfaces, and the one-line reason for its state.
 *
 * Typed as `Record<CapabilityKey, …>` on purpose: a new capability added to
 * `BACKEND_CAPABILITIES` forces a decision here, and a key removed from it
 * forces one to be deleted. `href: null` means the capability is real but has
 * no screen of its own — it is served inside another destination.
 */
const CAPABILITY_SCREENS: Record<
  CapabilityKey,
  { href: string | null; note: string }
> = {
  auth: { href: null, note: 'Session and vault state; owns the lock/unlock flow' },
  vault: { href: routes.vault, note: 'Vault home, metadata and portfolio summary' },
  wallets: { href: routes.wallets, note: 'List, groups and per-wallet detail' },
  walletCreate: { href: routes.walletsCreate, note: 'Keypair generation on the backend' },
  walletImportSecret: { href: routes.walletsImport, note: 'Imports a secret key into the vault' },
  walletImportWatchOnly: { href: routes.walletsImport, note: 'Registers an address without a key' },
  assets: { href: routes.assets, note: 'Token index with price, value and risk' },
  assetDetail: { href: routes.assets, note: 'Full per-mint record' },
  portfolioSummary: { href: routes.vaultPortfolio, note: 'Total value and per-wallet split' },
  portfolioSnapshots: { href: routes.vaultPortfolio, note: 'Snapshots are written; see portfolioHistory' },
  portfolioHistory: {
    href: routes.vaultPortfolio,
    note: 'Snapshots are persisted, but the backend does not expose a GET history endpoint yet',
  },
  activity: { href: routes.activity, note: 'Timeline of records with type and status' },
  activityFilterByWallet: {
    href: null,
    note: 'No server-side wallet filter; the wallet context is applied in this app',
  },
  receive: { href: routes.receive, note: 'Address to receive on, for the selected wallet' },
  alerts: { href: routes.alerts, note: 'Persisted alerts plus configurable threshold rules and evaluation' },
  risk: { href: routes.risk, note: 'Asset risk buckets across the vault' },
  providers: { href: routes.providers, note: 'Configured providers and their capabilities' },
  providerHealth: { href: null, note: 'Responds, but the API declares no response model' },
  rpc: { href: routes.rpc, note: 'Endpoint status, latency and counters' },
  researchSearch: { href: routes.discover, note: 'Substring search over assets already in the vault' },
  watchlists: { href: routes.watchlists, note: 'List and create; no rename, delete or re-order' },
  strategies: { href: routes.strategies, note: 'Persisted strategies with scheduled/manual runs and run history' },
  accounting: { href: routes.accounting, note: 'List and create; no update or delete' },
  backups: { href: routes.backups, note: 'Create, list, verify, restore, rollback and delete encrypted backups' },
  backupRestore: { href: routes.backups, note: 'Password-validated staged restore with automatic pre-restore rollback' },
  executionSimulate: {
    href: routes.execution,
    note: 'Real transaction simulation is available from the execution screen',
  },
  executionRecords: {
    href: routes.execution,
    note: 'Persistent execution history is available from the execution screen',
  },
  executionTransfer: {
    href: routes.execution,
    note: 'Transfer construction and simulation exist; live broadcast is globally disabled by default',
  },
  executionSwap: {
    href: routes.execution,
    note: 'Jupiter quote, build and simulation exist; live broadcast is globally disabled by default',
  },
  multisig: {
    href: routes.multisig,
    note: 'Off-chain Ed25519 proposal approvals; no on-chain multisig program integration',
  },
  addressBook: { href: routes.unavailable('addresses'), note: 'No address-book route is implemented' },
  settings: { href: routes.unavailable('settings'), note: 'No preferences, profile or config route' },
  tokenScreener: {
    href: routes.unavailable('token-screener'),
    note: 'No screening, ranking or discovery endpoint',
  },
  walletIntelligence: {
    href: routes.unavailable('wallet-intelligence'),
    note: 'No holder or counterparty investigation endpoint',
  },
  developerIntelligence: {
    href: routes.unavailable('developer-intelligence'),
    note: 'No program or deployer analysis endpoint',
  },
  signatures: {
    href: routes.unavailable('signatures'),
    note: 'Activity records carry no guaranteed signature field',
  },
  syncControl: {
    href: routes.unavailable('sync'),
    note: 'Workers run on an interval; nothing to start, pause or inspect',
  },
  websocketEvents: { href: null, note: 'Drives the connection indicator and live invalidation' },
  health: { href: routes.vaultHealth, note: 'Unversioned probe: status, vault exists, vault locked' },
};

type Row_ = {
  key: CapabilityKey;
  availability: Availability;
  href: string | null;
  note: string;
};

const REGISTER: Row_[] = (Object.keys(BACKEND_CAPABILITIES) as CapabilityKey[]).map((key) => ({
  key,
  availability: BACKEND_CAPABILITIES[key],
  href: CAPABILITY_SCREENS[key].href,
  note: CAPABILITY_SCREENS[key].note,
}));

export default function AdvancedScreen() {
  const router = useRouter();
  const [availability, setAvailability] = useState(ALL);

  usePageMeta({
    title: 'Advanced / Future',
    subtitle: 'The full capability register for this build',
    breadcrumbs: [{ label: 'Advanced / Future' }],
  });

  const counts = useMemo(() => {
    const by = { live: 0, partial: 0, unavailable: 0 } as Record<Availability, number>;
    for (const row of REGISTER) by[row.availability] += 1;
    return by;
  }, []);

  const rows = useMemo(
    () => (availability === ALL ? REGISTER : REGISTER.filter((row) => row.availability === availability)),
    [availability],
  );

  const gaps = useMemo(() => REGISTER.filter((row) => row.availability !== 'live'), []);

  const filterGroups: FilterGroup[] = [
    {
      key: 'availability',
      label: 'State',
      value: availability,
      onChange: setAvailability,
      options: [
        { key: ALL, label: 'All', count: REGISTER.length },
        { key: 'live', label: 'Live', count: counts.live },
        { key: 'partial', label: 'Partial', count: counts.partial },
        { key: 'unavailable', label: 'Unavailable', count: counts.unavailable },
      ],
    },
  ];

  const columns: Column<Row_>[] = useMemo(
    () => [
      {
        key: 'key',
        header: 'Capability',
        width: COLUMNS.capability,
        sortable: true,
        sortValue: (row) => row.key,
        render: (row) => (
          <Text variant="monoSmall" numberOfLines={1}>
            {row.key}
          </Text>
        ),
      },
      {
        key: 'availability',
        header: 'State',
        width: COLUMNS.status,
        sortable: true,
        sortValue: (row) => row.availability,
        render: (row) => <StatusBadge status={row.availability} size="sm" />,
      },
      {
        key: 'href',
        header: 'Screen',
        width: COLUMNS.screen,
        render: (row) =>
          row.href ? (
            <Text variant="caption" tone="accent" numberOfLines={1}>
              {row.href}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              Served inside another screen
            </Text>
          ),
      },
      {
        key: 'note',
        header: 'What the backend provides',
        width: COLUMNS.note,
        sortable: true,
        sortValue: (row) => row.note,
        render: (row) => (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {row.note}
          </Text>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Advanced / Future"
          subtitle="Every capability this build was planned against, and the state the backend actually leaves it in."
          badges={
            counts.unavailable > 0 ? (
              <StatusBadge
                status="partial"
                label={`${gaps.length} OF ${REGISTER.length} NOT FULLY LIVE`}
              />
            ) : null
          }
        />

        <Card>
          <Stack gap={spacing.md}>
            <Text variant="body" tone="secondary">
              The architecture blueprint behind SOLANA VAULT describes market data, strategy,
              risk and execution as separate engines. What ships today is the vault: keys, wallets,
              assets, activity and the monitoring that surrounds them. This register is the honest
              difference between the two, kept in code rather than in a document so it cannot drift
              from the routes it describes.
            </Text>
            <Text variant="caption" tone="muted">
              Generated from the same capability map the menu and the unavailable-state route read.
              Solana only — nothing here implies a second chain or a different trust model.
            </Text>
          </Stack>
        </Card>

        <MetricCard
          label="Fully live"
          value={`${counts.live} / ${REGISTER.length}`}
          sublabel={`${counts.partial} partial · ${counts.unavailable} not implemented by the backend`}
          tone={gaps.length > 0 ? 'warning' : 'success'}
        />

        {/* ── The register ────────────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Capability register"
            subtitle="Live, partial and not implemented — filterable"
          />
          <View style={{ marginTop: spacing.md }}>
            <DataTable
              columns={columns}
              data={rows}
              getRowKey={(row) => row.key}
              onRowPress={(row) => {
                if (row.href) router.push(row.href as never);
              }}
              emptyTitle="No capabilities in this state"
              emptyHint="Change the state filter to see the rest of the register."
              caption="Capabilities, read from BACKEND_CAPABILITIES"
              initialSort={{ key: 'availability', direction: 'desc' }}
              toolbar={
                <FilterBar
                  groups={filterGroups}
                  activeCount={availability === ALL ? 0 : 1}
                  onClear={() => setAvailability(ALL)}
                />
              }
            />
          </View>
        </View>

        {/* ── Why each declared gap is spelled out ─────────────────── */}
        <View>
          <SectionHeader
            title="Declared gaps"
            subtitle="The specific endpoint each one is waiting on"
          />
          <Stack gap={spacing.md} style={styles.gapStack}>
            {Object.entries(UNAVAILABLE_FEATURES).map(([feature, entry]) => (
              <ExpandableSection
                key={feature}
                title={entry.title}
                subtitle={entry.reason}
                testID={`gap-${feature}`}
              >
                <Stack gap={spacing.md}>
                  <Text variant="body" tone="secondary">
                    {entry.backendNote}
                  </Text>
                  <Row gap={spacing.md} wrap>
                    <Button
                      label="Open the destination"
                      variant="secondary"
                      size="sm"
                      onPress={() => router.push(routes.unavailable(feature) as never)}
                    />
                  </Row>
                </Stack>
              </ExpandableSection>
            ))}
          </Stack>
        </View>

        {/* ── Partial capabilities ─────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Partially implemented"
            subtitle="Real endpoints, with a real ceiling"
          />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              {gaps
                .filter((row) => row.availability === 'partial')
                .map((row) => (
                  <View key={row.key} style={styles.gapRow}>
                    <Row justify="space-between" align="center" gap={spacing.md}>
                      <Text variant="monoSmall" tone="secondary" style={styles.flex}>
                        {row.key}
                      </Text>
                      <StatusBadge status="partial" size="sm" />
                    </Row>
                    <Text variant="caption" tone="muted">
                      {row.note}
                    </Text>
                  </View>
                ))}
              {gaps.filter((row) => row.availability === 'partial').length === 0 ? (
                <Text variant="caption" tone="muted">
                  No capability is in a partial state in this build.
                </Text>
              ) : null}
            </Stack>
          </Card>
        </View>

        <NoticeBanner
          tone="neutral"
          title="Why an unimplemented feature still has a screen"
          message="A destination that exists in the design but not in the API gets an explicit state naming the missing capability, rather than a blank page or a quiet omission. That keeps the information architecture honest and gives the backend somewhere to land the work. Nothing on this screen is a placeholder for behaviour — it is a report on what exists."
        />

        <Row gap={spacing.lg} wrap>
          <Button
            label="All screens"
            variant="tertiary"
            size="sm"
            onPress={() => router.push(routes.allTabs as never)}
          />
          <Button
            label="Menu"
            variant="tertiary"
            size="sm"
            onPress={() => router.push(routes.menu as never)}
          />
        </Row>
      </Stack>
    </PageContainer>
  );
}

const styles = {
  flex: { flex: 1 },
  gapStack: { marginTop: spacing.md },
  gapRow: { gap: spacing.xs },
} as const;