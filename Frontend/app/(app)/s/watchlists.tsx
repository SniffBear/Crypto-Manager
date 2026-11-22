/**
 * WATCHLISTS — named groups of mint addresses.
 *
 * The backend models a watchlist as `{ id, name, assets: string[] }` and
 * exposes exactly two operations on it: list and create
 * (`GET /watchlists`, `POST /watchlists`). There is no update, no delete, no
 * add-or-remove-a-single-asset route, and no per-watchlist market data.
 *
 * So this screen is read-mostly by necessity, not by choice: the table shows
 * exactly the four fields the backend stores, and the notice at the bottom
 * names the operations that do not exist instead of leaving a user wondering
 * where the rename button went.
 *
 * Data: GET /watchlists, POST /watchlists
 */

import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader } from '@/components/chrome/PageHeader';
import { usePageMeta, useSheet } from '@/components/chrome/shell-context';
import { DataTable, type Column } from '@/components/DataTable';
import { MetricCard, SearchBar } from '@/components/data';
import { TokenIcon } from '@/components/utility';
import { NoticeBanner } from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useCreateWatchlist,
  useWatchlists,
  type Watchlist,
} from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatNumber, shortenMint } from '@/utils/format';

const COLUMNS = {
  name: 200,
  assets: 260,
  count: 96,
  id: 176,
} as const;

export default function WatchlistsScreen() {
  const router = useRouter();
  const { open } = useSheet();
  const [query, setQuery] = useState('');
  const [createError, setCreateError] = useState<string | undefined>(undefined);

  const watchlists = useWatchlists();
  const create = useCreateWatchlist();

  usePageMeta({
    title: 'Watchlists',
    subtitle: 'Named groups of mint addresses stored in the vault',
    breadcrumbs: [{ label: 'Watchlists' }],
  });

  const all = watchlists.data ?? [];

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (list) =>
        list.name.toLowerCase().includes(term) ||
        list.id.toLowerCase().includes(term) ||
        list.assets.some((mint) => mint.toLowerCase().includes(term)),
    );
  }, [all, query]);

  const tracked = useMemo(() => {
    const set = new Set<string>();
    for (const list of all) for (const mint of list.assets) set.add(mint);
    return set;
  }, [all]);

  const empty = all.filter((list) => list.assets.length === 0).length;

  const openCreate = useCallback(() => {
    setCreateError(undefined);
    open({
      title: 'New watchlist',
      subtitle: 'A name, and optionally the mints it starts with',
      render: (close) => <CreateWatchlistSheet onClose={close} />,
    });
  }, [open]);

  const columns: Column<Watchlist>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Watchlist',
        width: COLUMNS.name,
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <View>
            <Text variant="label" numberOfLines={1}>
              {row.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {row.assets.length === 0 ? 'No assets yet' : `${row.assets.length} mint entries`}
            </Text>
          </View>
        ),
      },
      {
        key: 'assets',
        header: 'Assets',
        width: COLUMNS.assets,
        render: (row) => {
          if (row.assets.length === 0) {
            return (
              <Text variant="caption" tone="muted">
                —
              </Text>
            );
          }
          const preview = row.assets.slice(0, 3);
          return (
            <Row gap={spacing.sm} align="center">
              {preview.map((mint) => (
                <TokenIcon key={mint} mint={mint} size={22} />
              ))}
              <Text variant="monoSmall" tone="secondary" numberOfLines={1}>
                {row.assets
                  .slice(0, 2)
                  .map((mint) => shortenMint(mint))
                  .join('  ')}
                {row.assets.length > 2 ? `  +${row.assets.length - 2}` : ''}
              </Text>
            </Row>
          );
        },
      },
      {
        key: 'count',
        header: 'Assets',
        width: COLUMNS.count,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.assets.length,
        render: (row) => (
          <Text
            variant="monoSmall"
            tone={row.assets.length === 0 ? 'muted' : 'secondary'}
            align="right"
          >
            {formatNumber(row.assets.length)}
          </Text>
        ),
      },
      {
        key: 'id',
        header: 'ID',
        width: COLUMNS.id,
        mono: true,
        sortable: true,
        sortValue: (row) => row.id,
        render: (row) => (
          <Text variant="monoSmall" tone="muted" numberOfLines={1}>
            {row.id}
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
          title="Watchlists"
          subtitle="Groups of mint addresses, held in the vault file alongside wallets and accounting."
          actions={
            <Button label="New watchlist" variant="secondary" size="sm" onPress={openCreate} />
          }
        />

        <MetricCard
          label="Tracked"
          value={String(all.length)}
          sublabel={`${tracked.size} unique mint${tracked.size === 1 ? '' : 's'} across every list · ${
            empty
          } list${empty === 1 ? '' : 's'} still empty`}
        />

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Filter by name, ID or mint"
        />

        {create.isError ? (
          <Card variant="flat">
            <Text variant="caption" tone={isRetryable(create.error) ? 'warning' : 'danger'}>
              {errorMessage(create.error)}
            </Text>
          </Card>
        ) : null}

        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          isLoading={watchlists.isLoading}
          error={watchlists.isError ? errorMessage(watchlists.error) : null}
          onRetry={() => void watchlists.refetch()}
          emptyTitle={all.length === 0 ? 'No watchlists' : 'No list matches this filter'}
          emptyHint={
            all.length === 0
              ? 'Create one to group the mints you care about. The backend stores only the name and the mint list.'
              : 'Clear the filter to see every list.'
          }
          caption="Watchlists"
          onRefresh={() => void watchlists.refetch()}
          refreshing={watchlists.isRefetching}
          initialSort={{ key: 'name', direction: 'asc' }}
        />

        <NoticeBanner
          tone="neutral"
          title="Create is the only operation the backend offers"
          message="There is no rename, delete, reorder or add-a-single-asset endpoint for a watchlist, and no per-watchlist price, risk or alert feed — the record is a name and a list of mints. Each mint is stored verbatim as supplied, so it is displayed here exactly as the backend holds it rather than resolved to a token this app has not seen."
        />

        <Button
          label="Browse assets"
          variant="tertiary"
          size="sm"
          onPress={() => router.push(routes.assets as never)}
        />
      </Stack>
    </PageContainer>
  );
}

function CreateWatchlistSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [mints, setMints] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const create = useCreateWatchlist();

  const submit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Give the watchlist a name.');
      return;
    }
    setError(undefined);

    // One entry per line or comma. Blank lines are dropped; duplicates removed
    // so the stored list is exactly what the operator typed, in order.
    const assets = [
      ...new Set(
        mints
          .split(/[\s,]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];

    create.mutate({ name: trimmedName, assets }, { onSuccess: onClose });
  }, [name, mints, create, onClose]);

  return (
    <Stack gap={spacing.lg}>
      <Input
        label="Name"
        value={name}
        onChangeText={(next) => {
          setName(next);
          if (error) setError(undefined);
        }}
        placeholder="Core holdings"
        autoCapitalize="words"
        error={error}
        autoFocus
      />

      <Input
        label="Mint addresses (optional)"
        value={mints}
        onChangeText={setMints}
        placeholder="One per line, or comma separated"
        multiline
        numberOfLines={4}
        mono
        autoCapitalize="none"
        autoCorrect={false}
        hint="Stored exactly as typed. A watchlist is not validated against a token list by the backend."
      />

      {create.isError ? (
        <Text variant="caption" tone="danger">
          {errorMessage(create.error)}
        </Text>
      ) : null}

      <Row gap={spacing.md}>
        <Button
          label="Create"
          variant="primary"
          loading={create.isPending}
          onPress={submit}
        />
        <Button label="Cancel" variant="tertiary" onPress={onClose} />
      </Row>
    </Stack>
  );
}