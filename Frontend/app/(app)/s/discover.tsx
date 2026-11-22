/**
 * DISCOVER — the backend's own asset search.
 *
 * `GET /research/search?q=` is the only search endpoint in the API. Reading
 * it (Backend/backend/api/research.py) settles what this screen can honestly
 * claim: it substring-matches `symbol`, `name` and `mint` against
 * `vault.data()["assets"]`. In other words it searches the tokens this vault
 * has already recorded. It does not reach a token registry, a price feed, a
 * trending list or the Solana network.
 *
 * So "Discover" here means "look up something already known to this vault",
 * and the screen says so in the header, in the empty state and at the bottom
 * rather than letting the section title imply a market-wide browser. The
 * destinations that *would* provide that — Token Screener, Wallet
 * Intelligence, Developer Intelligence — are declared and linked so the gap is
 * one tap away rather than invisible.
 *
 * Data: GET /research/search?q=
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
import { ListRow, MetricCard, SearchBar } from '@/components/data';
import { AddressDisplay, TokenIcon } from '@/components/utility';
import { StatusBadge } from '@/components/StatusBadge';
import { NoticeBanner } from '@/components/feedback/states';
import { errorMessage, isRetryable, useResearch, type Asset } from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatDate, formatUsd, formatUsdCompact } from '@/utils/format';

const COLUMNS = {
  asset: 200,
  mint: 164,
  price: 112,
  value: 120,
  risk: 120,
  updated: 112,
} as const;

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const research = useResearch(query);
  const term = query.trim();

  usePageMeta({
    title: 'Discover',
    subtitle: 'Look up a token this vault already knows about',
    breadcrumbs: [{ label: 'Discover' }],
  });

  const results = research.data ?? [];
  const totalValue = useMemo(
    () => results.reduce((sum, asset) => sum + (asset.value_usd ?? 0), 0),
    [results],
  );

  const columns: Column<Asset>[] = useMemo(
    () => [
      {
        key: 'symbol',
        header: 'Asset',
        width: COLUMNS.asset,
        sortable: true,
        sortValue: (row) => row.symbol ?? row.name ?? row.mint,
        render: (row) => (
          <Row gap={spacing.md} align="center">
            <TokenIcon mint={row.mint} symbol={row.symbol} size={28} />
            <View style={styles.flex}>
              <Text variant="label" numberOfLines={1}>
                {row.symbol ?? '—'}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {row.name ?? 'Unnamed token'}
              </Text>
            </View>
          </Row>
        ),
      },
      {
        key: 'mint',
        header: 'Mint',
        width: COLUMNS.mint,
        render: (row) => <AddressDisplay value={row.mint} kind="mint" size="sm" />,
      },
      {
        key: 'price_usd',
        header: 'Price',
        width: COLUMNS.price,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.price_usd ?? -1,
        render: (row) => (
          <Text variant="monoSmall" tone="secondary" align="right">
            {formatUsd(row.price_usd, { decimals: 4 })}
          </Text>
        ),
      },
      {
        key: 'value_usd',
        header: 'Value',
        width: COLUMNS.value,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.value_usd ?? -1,
        render: (row) => (
          <Text variant="monoSmall" align="right">
            {formatUsdCompact(row.value_usd)}
          </Text>
        ),
      },
      {
        key: 'risk',
        header: 'Risk',
        width: COLUMNS.risk,
        sortable: true,
        sortValue: (row) => row.risk ?? 'zzz',
        render: (row) => <StatusBadge status={row.risk ?? 'unknown'} size="sm" />,
      },
      {
        key: 'updated_at',
        header: 'Updated',
        width: COLUMNS.updated,
        align: 'right',
        sortable: true,
        sortValue: (row) => row.updated_at ?? '',
        render: (row) => (
          <Text variant="monoSmall" tone="muted" align="right">
            {formatDate(row.updated_at)}
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
          title="Discover"
          subtitle="Searches the tokens this vault has already recorded. It is a lookup, not a market browser."
          badges={<StatusBadge status="partial" label="VAULT SCOPED" size="sm" />}
        />

        <View>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Symbol, name or mint — e.g. SOL"
            onSubmit={() => void research.refetch()}
          />
        </View>

        {term ? (
          <MetricCard
            label="Matches"
            value={String(results.length)}
            sublabel={`${formatUsd(totalValue)} of tracked value across the matches`}
          />
        ) : null}

        <DataTable
          columns={columns}
          data={results}
          getRowKey={(row) => row.mint}
          isLoading={research.isLoading}
          error={research.isError ? errorMessage(research.error) : null}
          onRetry={() => void research.refetch()}
          onRowPress={(row) => router.push(routes.assetDetail(row.mint) as never)}
          emptyTitle={term ? 'No token in this vault matches' : 'Nothing to search yet'}
          emptyHint={
            term
              ? 'The backend only searches assets it already holds, so a token nobody in this vault has touched will never appear — whatever its real-world popularity.'
              : 'Enter a symbol, name or mint. Results are the tokens this vault already records.'
          }
          caption="Assets known to this vault"
          onRefresh={() => void research.refetch()}
          refreshing={research.isRefetching}
          initialSort={{ key: 'value_usd', direction: 'desc' }}
        />

        {research.isError && !isRetryable(research.error) ? (
          <NoticeBanner
            tone="warning"
            title="The vault may be locked"
            message="A 423 from the backend means the vault is locked rather than the request being wrong. Unlock it and run the search again."
          />
        ) : null}

        {/* ── What discovery does not cover ───────────────────────── */}
        <View>
          <SectionHeader
            title="Not covered by this search"
            subtitle="Declared destinations the backend does not implement"
          />
          <Card padded={false} style={styles.listCard}>
            <Stack gap={spacing.sm} style={styles.listPad}>
              <ListRow
                title="Token Screener"
                subtitle="Filter, rank and sort a universe of tokens. No screening endpoint exists."
                onPress={() => router.push(routes.unavailable('token-screener') as never)}
                badges={<StatusBadge status="unavailable" size="sm" />}
              />
              <ListRow
                title="Wallet Intelligence"
                subtitle="Investigate a holder or counterparty. No such endpoint exists."
                onPress={() => router.push(routes.unavailable('wallet-intelligence') as never)}
                badges={<StatusBadge status="unavailable" size="sm" />}
              />
              <ListRow
                title="Developer Intelligence"
                subtitle="Analyse a program or deployer. No such endpoint exists."
                onPress={() => router.push(routes.unavailable('developer-intelligence') as never)}
                badges={<StatusBadge status="unavailable" size="sm" />}
              />
            </Stack>
          </Card>
        </View>

        <NoticeBanner
          tone="neutral"
          title="Why results stop at this vault"
          message="`GET /research/search` reads the vault's own asset table and substring-matches the symbol, name and mint. There is no registry query, no price oracle, no trending feed and no new-listing detection in the backend, so a token this vault has never seen cannot be discovered here however much it trades. Prices and risk shown above are whatever the backend last recorded, with the timestamp it recorded them at."
        />

        <Button
          label="Risk monitor"
          variant="tertiary"
          size="sm"
          onPress={() => router.push(routes.risk as never)}
        />
      </Stack>
    </PageContainer>
  );
}

const styles = {
  flex: { flex: 1 },
  listCard: { marginTop: spacing.md },
  listPad: { padding: spacing.lg },
} as const;