/**
 * SEARCH — one field over destinations and content.
 *
 * DESIGN.md §25 asks for command-style search over wallets, assets,
 * transactions, alerts, watchlists, strategies, providers and accounting.
 * Two halves, deliberately split:
 *
 *  - **Screens** come from `navigation/config.ts`. They are the information
 *    architecture itself, so a destination cannot exist without being
 *    findable here — including the ones the backend does not implement, which
 *    resolve to their explicit unavailable state.
 *  - **Content** comes from `useCommandSearch`, which reuses the query keys the
 *    rest of the app already reads and fetches nothing until something has
 *    been typed. Matching is a case-insensitive substring over the fields the
 *    backend returns.
 *
 * Matching happens in this app rather than on the server because the only
 * server-side search in the API is `GET /research/search`, and that searches
 * assets the vault already holds. The backend has no search index, no ranking
 * and no fuzzy matching, so none is simulated — results are grouped by
 * collection, capped per group, and never reordered by "relevance".
 *
 * Addresses are absent from the group list because the backend exposes no
 * address book to search; that gap is named on the screen rather than hidden.
 *
 * Data: GET /wallets, /assets, /activity, /alerts, /watchlists, /strategies,
 *       /providers, /accounting
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
import { EmptyState, NoticeBanner, SkeletonList } from '@/components/feedback/states';
import { ListRow, SearchBar } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { TokenIcon, WalletAvatar } from '@/components/utility';
import { ALERT_TONE } from '@/design/status';
import {
  COMMAND_GROUP_LIMIT,
  useCommandSearch,
  type AccountingEntry,
  type ActivityRecord,
  type Alert,
  type Asset,
  type ProviderSummary,
  type Strategy,
  type Wallet,
  type Watchlist,
} from '@/hooks/useApi';
import { allDestinations, routes } from '@/navigation/config';
import {
  formatRelative,
  formatUsdCompact,
  shortenAddress,
  shortenMint,
  titleCase,
} from '@/utils/format';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const search = useCommandSearch(query);
  const { matches, active } = search;

  usePageMeta({
    title: 'Search',
    subtitle: 'Destinations and vault content, in one field',
    breadcrumbs: [{ label: 'Search' }],
  });

  const destinations = useMemo(() => {
    const term = search.term;
    if (!term) return [];
    return allDestinations()
      .filter(
        (item) =>
          item.label.toLowerCase().includes(term) ||
          item.section.toLowerCase().includes(term) ||
          (item.detail ?? '').toLowerCase().includes(term),
      )
      .slice(0, COMMAND_GROUP_LIMIT);
  }, [search.term]);

  const grandTotal =
    search.total + destinations.length;

  const hasResults = grandTotal > 0;

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Search"
          subtitle="One field across every destination and every collection this vault holds."
          badges={
            active ? (
              <StatusBadge
                status={hasResults ? 'ok' : 'unknown'}
                label={
                  hasResults
                    ? `${grandTotal} MATCH${grandTotal === 1 ? '' : 'ES'}`
                    : 'NO MATCHES'
                }
              />
            ) : null
          }
        />

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Wallet label, mint, transaction id, alert, destination…"
          autoFocus
        />

        {!active ? (
          <EmptyState
            title="Start typing"
            hint="Results are grouped by collection — screens, wallets, assets, transactions, alerts, watchlists, strategies, providers and accounting. Nothing is fetched until a term is entered."
          />
        ) : search.isLoading ? (
          <SkeletonList count={6} />
        ) : !hasResults ? (
          <EmptyState
            title={`Nothing matches “${query.trim()}”`}
            hint="Matching is a plain case-insensitive substring over the fields the backend returns. There is no fuzzy matching, ranking or synonym expansion, so a fragment of a label, address, mint or id is what finds a record."
            actionLabel="Clear search"
            onAction={() => setQuery('')}
          />
        ) : (
          <Stack gap={spacing.xxl}>
            {destinations.length > 0 ? (
              <ResultGroup
                title="Screens"
                count={destinations.length}
                truncated={destinations.length === COMMAND_GROUP_LIMIT}
              >
                {destinations.map((item) => (
                  <ListRow
                    key={`${item.section}/${item.label}`}
                    title={item.label}
                    subtitle={item.section}
                    meta={item.detail}
                    onPress={() => router.push(item.href as never)}
                    badges={
                      item.availability === 'live' ? null : (
                        <StatusBadge
                          status={item.availability === 'partial' ? 'partial' : 'unavailable'}
                          size="sm"
                        />
                      )
                    }
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.wallets.length > 0 ? (
              <ResultGroup title="Wallets" count={matches.wallets.length} truncated={isCapped(matches.wallets.length)}>
                {matches.wallets.map((wallet: Wallet) => (
                  <ListRow
                    key={wallet.id}
                    title={wallet.label}
                    subtitle={`${shortenAddress(wallet.address)}${wallet.group ? ` · ${wallet.group}` : ''}`}
                    leading={<WalletAvatar address={wallet.address} label={wallet.label} size={30} />}
                    badges={
                      <Row gap={spacing.sm} wrap>
                        {wallet.watch_only ? <StatusBadge status="watch_only" size="sm" /> : null}
                        {wallet.cold_storage ? <StatusBadge status="cold_storage" size="sm" /> : null}
                      </Row>
                    }
                    onPress={() => router.push(routes.walletDetail(wallet.id) as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.assets.length > 0 ? (
              <ResultGroup title="Assets" count={matches.assets.length} truncated={isCapped(matches.assets.length)}>
                {matches.assets.map((asset: Asset) => (
                  <ListRow
                    key={asset.mint}
                    title={asset.symbol ?? shortenMint(asset.mint)}
                    subtitle={asset.name ?? shortenMint(asset.mint)}
                    leading={<TokenIcon mint={asset.mint} symbol={asset.symbol} size={30} />}
                    meta={formatUsdCompact(asset.value_usd)}
                    badges={asset.risk ? <StatusBadge status={asset.risk} size="sm" /> : null}
                    onPress={() => router.push(routes.assetDetail(asset.mint) as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.transactions.length > 0 ? (
              <ResultGroup
                title="Transactions"
                count={matches.transactions.length}
                truncated={isCapped(matches.transactions.length)}
              >
                {matches.transactions.map((record: ActivityRecord) => (
                  <ListRow
                    key={record.id}
                    title={titleCase(record.type)}
                    subtitle={record.destination ?? record.id}
                    meta={formatRelative(record.created_at)}
                    badges={<StatusBadge status={record.status} size="sm" />}
                    onPress={() => router.push(routes.activityDetail(record.id) as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.alerts.length > 0 ? (
              <ResultGroup title="Alerts" count={matches.alerts.length} truncated={isCapped(matches.alerts.length)}>
                {matches.alerts.map((alert: Alert) => (
                  <ListRow
                    key={alert.id}
                    title={alert.title}
                    subtitle={alert.message}
                    meta={`${titleCase(alert.kind)} · ${formatRelative(alert.created_at)}`}
                    badges={
                      <Row gap={spacing.sm} wrap>
                        <StatusBadge status={alert.level} size="sm" tone={ALERT_TONE[alert.level]} />
                        <StatusBadge status={alert.read ? 'read' : 'unread'} size="sm" />
                      </Row>
                    }
                    onPress={() => router.push(routes.alerts as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.watchlists.length > 0 ? (
              <ResultGroup
                title="Watchlists"
                count={matches.watchlists.length}
                truncated={isCapped(matches.watchlists.length)}
              >
                {matches.watchlists.map((list: Watchlist) => (
                  <ListRow
                    key={list.id}
                    title={list.name}
                    subtitle={
                      list.assets.length === 0
                        ? 'No assets'
                        : `${list.assets.length} mint${list.assets.length === 1 ? '' : 's'}`
                    }
                    meta={list.assets[0] ? shortenMint(list.assets[0]) : undefined}
                    onPress={() => router.push(routes.watchlists as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.strategies.length > 0 ? (
              <ResultGroup
                title="Strategies"
                count={matches.strategies.length}
                truncated={isCapped(matches.strategies.length)}
              >
                {matches.strategies.map((strategy: Strategy) => (
                  <ListRow
                    key={strategy.id}
                    title={strategy.name}
                    subtitle={
                      strategy.rules.length === 0
                        ? 'No rules stored'
                        : `${strategy.rules.length} rule${strategy.rules.length === 1 ? '' : 's'}`
                    }
                    badges={
                      <StatusBadge
                        status={strategy.enabled ? 'granted' : 'denied'}
                        label={strategy.enabled ? 'ENABLED' : 'DISABLED'}
                        size="sm"
                      />
                    }
                    onPress={() => router.push(routes.strategies as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.providers.length > 0 ? (
              <ResultGroup
                title="Providers"
                count={matches.providers.length}
                truncated={isCapped(matches.providers.length)}
              >
                {matches.providers.map((provider: ProviderSummary) => (
                  <ListRow
                    key={provider.name}
                    title={provider.name}
                    subtitle={provider.base_url ?? 'No base URL configured'}
                    meta={provider.capabilities.length > 0 ? provider.capabilities.join(', ') : undefined}
                    badges={
                      <StatusBadge
                        status={provider.configured ? 'configured' : 'unconfigured'}
                        size="sm"
                      />
                    }
                    onPress={() => router.push(routes.providers as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}

            {matches.accounting.length > 0 ? (
              <ResultGroup
                title="Accounting"
                count={matches.accounting.length}
                truncated={isCapped(matches.accounting.length)}
              >
                {matches.accounting.map((entry: AccountingEntry) => (
                  <ListRow
                    key={entry.id}
                    title={entry.description || titleCase(entry.type)}
                    subtitle={titleCase(entry.type)}
                    meta={formatUsdCompact(entry.amount_usd)}
                    onPress={() => router.push(routes.accounting as never)}
                  />
                ))}
              </ResultGroup>
            ) : null}
          </Stack>
        )}

        {search.failedGroups.length > 0 ? (
          <NoticeBanner
            tone="warning"
            title="Some collections could not be read"
            message={`These results are incomplete: ${search.failedGroups
              .map((key) => titleCase(key))
              .join(', ')} failed to load, so those groups are missing rather than shown as empty. Everything listed above is real data.`}
          />
        ) : null}

        <View>
          <SectionHeader
            title="What search cannot do"
            subtitle="Stated here rather than left to be discovered"
          />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Text variant="body" tone="secondary">
                The backend has no search index. The only server-side search in the API is
                <Text variant="monoSmall"> GET /research/search</Text>, which matches substrings
                against assets this vault already holds — it does not reach a registry, a market
                or the network. Everything above is matched in the app, against data already
                loaded through the same query keys the rest of SOLANA VAULT uses.
              </Text>
              <Text variant="body" tone="secondary">
                Addresses are a declared result group in the design, but the backend exposes no
                address book, so there is nothing to search. The group is absent rather than
                shown empty.
              </Text>
              <Text variant="caption" tone="muted">
                No recent-search history is kept. Persisting what an operator has typed into a
                security tool is not something the backend offers a home for, and this app does
                not invent one.
              </Text>
            </Stack>
          </Card>
        </View>

        <Button
          label="All screens"
          variant="tertiary"
          size="sm"
          onPress={() => router.push(routes.allTabs as never)}
        />
      </Stack>
    </PageContainer>
  );
}

/** A group showing exactly the cap may have more matches behind it. */
function isCapped(count: number): boolean {
  return count === COMMAND_GROUP_LIMIT;
}

function ResultGroup({
  title,
  count,
  truncated,
  children,
}: {
  title: string;
  count: number;
  truncated: boolean;
  children: React.ReactNode;
}) {
  return (
    <View>
      <SectionHeader
        title={title}
        subtitle={
          truncated
            ? `First ${count} — narrow the term to see the rest`
            : `${count} match${count === 1 ? '' : 'es'}`
        }
      />
      <Card padded={false} style={styles.groupCard}>
        <Stack gap={spacing.sm} style={styles.listPad}>
          {children}
        </Stack>
      </Card>
    </View>
  );
}

const styles = {
  groupCard: { marginTop: spacing.md },
  listPad: { padding: spacing.lg },
} as const;