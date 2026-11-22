/**
 * ACCOUNTING — the vault's own ledger of manual entries.
 *
 * An entry is `{ id, type, description, amount_usd, wallet_id, asset_mint }`
 * (Backend/backend/api/accounting.py). The API stores `type` as a free-form
 * string: it is not an enum, there is no sign convention and no category
 * table. So this screen does *not* split income from expense or colour entries
 * as gains and losses — that classification is not in the data, and inferring
 * it from a word like "sell" would be inventing accounting. What it does show
 * is the sum of the amounts, the types actually in use, and the optional
 * wallet and mint attribution.
 *
 * `GET /accounting` returns the stored list reversed, so the newest entry is
 * already first; no client-side reordering is applied on top of that.
 *
 * Data: GET /accounting, POST /accounting
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
import { FilterBar, MetricCard, SearchBar, type FilterGroup } from '@/components/data';
import { AddressDisplay, TokenIcon, WalletAvatar } from '@/components/utility';
import { NoticeBanner } from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useAccounting,
  useCreateAccountingEntry,
  useWallets,
  type AccountingEntry,
} from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatUsd, titleCase } from '@/utils/format';

const COLUMNS = {
  description: 260,
  type: 132,
  amount: 132,
  wallet: 176,
  asset: 168,
} as const;

const ALL = 'all';

/** Common entry types offered as shortcuts. None of them is enforced by the
 *  backend — the field is a free string, and these are simply starting points. */
const TYPE_SHORTCUTS = ['buy', 'sell', 'fee', 'airdrop', 'income', 'transfer'];

export default function AccountingScreen() {
  const router = useRouter();
  const { open } = useSheet();
  const [query, setQuery] = useState('');
  const [type, setType] = useState(ALL);

  const accounting = useAccounting();
  const wallets = useWallets();
  const create = useCreateAccountingEntry();

  usePageMeta({
    title: 'Accounting',
    subtitle: 'Manual ledger entries stored in the vault file',
    breadcrumbs: [{ label: 'Accounting' }],
  });

  const all = accounting.data ?? [];

  const walletById = useMemo(() => {
    const map = new Map<string, string>();
    for (const wallet of wallets.data ?? []) map.set(wallet.id, wallet.label);
    return map;
  }, [wallets.data]);

  const types = useMemo(() => {
    const set = new Set(all.map((entry) => entry.type));
    return [...set].sort();
  }, [all]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter((entry) => {
      if (type !== ALL && entry.type !== type) return false;
      if (!term) return true;
      return (
        entry.description.toLowerCase().includes(term) ||
        entry.type.toLowerCase().includes(term) ||
        entry.id.toLowerCase().includes(term) ||
        Boolean(entry.asset_mint && entry.asset_mint.toLowerCase().includes(term)) ||
        Boolean(entry.wallet_id && entry.wallet_id.toLowerCase().includes(term))
      );
    });
  }, [all, query, type]);

  const total = all.reduce((sum, entry) => sum + entry.amount_usd, 0);
  const attributed = all.filter((entry) => entry.wallet_id !== null).length;
  const withAsset = all.filter((entry) => entry.asset_mint !== null).length;

  const openCreate = useCallback(() => {
    open({
      title: 'New entry',
      subtitle: 'Recorded in the vault file — it does not touch the chain',
      render: (close) => <CreateEntrySheet onClose={close} />,
    });
  }, [open]);

  const filterGroups: FilterGroup[] = [
    {
      key: 'type',
      label: 'Type',
      value: type,
      onChange: setType,
      options: [
        { key: ALL, label: 'All', count: all.length },
        ...types.map((value) => ({
          key: value,
          label: titleCase(value),
          count: all.filter((entry) => entry.type === value).length,
        })),
      ],
    },
  ];

  const columns: Column<AccountingEntry>[] = useMemo(
    () => [
      {
        key: 'description',
        header: 'Description',
        width: COLUMNS.description,
        sortable: true,
        sortValue: (row) => row.description,
        render: (row) => (
          <View>
            <Text variant="label" numberOfLines={1}>
              {row.description || '—'}
            </Text>
            <Text variant="monoSmall" tone="muted" numberOfLines={1}>
              {row.id}
            </Text>
          </View>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        width: COLUMNS.type,
        sortable: true,
        sortValue: (row) => row.type,
        render: (row) => (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {titleCase(row.type)}
          </Text>
        ),
      },
      {
        key: 'amount_usd',
        header: 'Amount',
        width: COLUMNS.amount,
        align: 'right',
        mono: true,
        sortable: true,
        sortValue: (row) => row.amount_usd,
        render: (row) => (
          <Text variant="monoSmall" align="right">
            {formatUsd(row.amount_usd)}
          </Text>
        ),
      },
      {
        key: 'wallet_id',
        header: 'Wallet',
        width: COLUMNS.wallet,
        render: (row) =>
          row.wallet_id ? (
            <Row gap={spacing.sm} align="center">
              <WalletAvatar address={row.wallet_id} label={walletById.get(row.wallet_id)} size={22} />
              <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
                {walletById.get(row.wallet_id) ?? row.wallet_id}
              </Text>
            </Row>
          ) : (
            <Text variant="caption" tone="muted">
              Not attributed
            </Text>
          ),
      },
      {
        key: 'asset_mint',
        header: 'Asset',
        width: COLUMNS.asset,
        render: (row) =>
          row.asset_mint ? (
            <Row gap={spacing.sm} align="center">
              <TokenIcon mint={row.asset_mint} size={20} />
              <AddressDisplay value={row.asset_mint} kind="mint" size="sm" />
            </Row>
          ) : (
            <Text variant="caption" tone="muted">
              —
            </Text>
          ),
      },
    ],
    [walletById],
  );

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Accounting"
          subtitle="Entries you record against the vault. The backend stores them verbatim; it performs no valuation, categorisation or reconciliation."
          actions={<Button label="New entry" variant="secondary" size="sm" onPress={openCreate} />}
        />

        <MetricCard
          label="Entry total"
          value={formatUsd(total)}
          sublabel={`${all.length} entr${all.length === 1 ? 'y' : 'ies'} · ${types.length} type${
            types.length === 1 ? '' : 's'
          } in use · ${attributed} attributed to a wallet · ${withAsset} carrying a mint`}
        />

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Filter descriptions, types, wallets or mints"
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
          isLoading={accounting.isLoading}
          error={accounting.isError ? errorMessage(accounting.error) : null}
          onRetry={() => void accounting.refetch()}
          emptyTitle={all.length === 0 ? 'No entries yet' : 'No entry matches these filters'}
          emptyHint={
            all.length === 0
              ? 'Record an entry to keep a ledger alongside the vault. Nothing is derived from on-chain activity automatically.'
              : 'Clear the search or the type filter to see every entry.'
          }
          caption="Entries, newest first"
          onRefresh={() => void accounting.refetch()}
          refreshing={accounting.isRefetching}
          initialSort={{ key: 'amount_usd', direction: 'desc' }}
          toolbar={
            <FilterBar
              groups={filterGroups}
              activeCount={type === ALL ? 0 : 1}
              onClear={() => setType(ALL)}
            />
          }
        />

        <NoticeBanner
          tone="neutral"
          title="The total is a sum, not a profit and loss"
          message="The backend stores `type` as a free-form string with no sign convention, no category table and no valuation timestamp, so this screen does not classify entries as income or expense — the figure above is the arithmetic sum of the amounts exactly as stored. There is also no update or delete endpoint, so an entry that was recorded in error can only be corrected by adding a new one. The filter above narrows the list in this app; the API accepts no query parameters here."
        />

        <Row gap={spacing.lg} wrap>
          <Button
            label="Assets"
            variant="tertiary"
            size="sm"
            onPress={() => router.push(routes.assets as never)}
          />
          <Button
            label="Activity"
            variant="tertiary"
            size="sm"
            onPress={() => router.push(routes.activity as never)}
          />
        </Row>
      </Stack>
    </PageContainer>
  );
}

function CreateEntrySheet({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [assetMint, setAssetMint] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const wallets = useWallets();
  const create = useCreateAccountingEntry();

  const submit = useCallback(() => {
    const trimmedType = type.trim();
    const trimmedDescription = description.trim();
    if (!trimmedType) {
      setError('Enter a type.');
      return;
    }
    if (!trimmedDescription) {
      setError('Enter a description.');
      return;
    }

    const text = amount.trim();
    let amountUsd = 0;
    if (text) {
      amountUsd = Number(text);
      if (!Number.isFinite(amountUsd)) {
        setError('Amount must be a number, or leave it blank for 0.');
        return;
      }
    }
    setError(undefined);

    create.mutate(
      {
        type: trimmedType,
        description: trimmedDescription,
        amount_usd: amountUsd,
        wallet_id: walletId,
        asset_mint: assetMint.trim() || null,
      },
      { onSuccess: onClose },
    );
  }, [type, description, amount, walletId, assetMint, create, onClose]);

  return (
    <Stack gap={spacing.lg}>
      <View>
        <Text variant="overline" tone="muted">
          Type
        </Text>
        <Input
          value={type}
          onChangeText={(next) => {
            setType(next);
            if (error) setError(undefined);
          }}
          placeholder="buy"
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
          autoFocus
        />
        <Row gap={spacing.sm} wrap style={styles.shortcuts}>
          {TYPE_SHORTCUTS.map((shortcut) => (
            <Button
              key={shortcut}
              label={shortcut}
              variant={type === shortcut ? 'primary' : 'tertiary'}
              size="sm"
              onPress={() => setType(shortcut)}
            />
          ))}
        </Row>
      </View>

      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Bought 2 SOL"
        autoCapitalize="sentences"
      />

      <Input
        label="Amount (USD)"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        mono
        keyboardType="decimal-pad"
        hint="Stored verbatim, including its sign. The backend applies no convention to it."
      />

      <View>
        <Text variant="overline" tone="muted">
          Wallet (optional)
        </Text>
        <Row gap={spacing.sm} wrap style={styles.shortcuts}>
          <Button
            label="None"
            variant={walletId === null ? 'primary' : 'tertiary'}
            size="sm"
            onPress={() => setWalletId(null)}
          />
          {(wallets.data ?? []).map((wallet) => (
            <Button
              key={wallet.id}
              label={wallet.label}
              variant={walletId === wallet.id ? 'primary' : 'tertiary'}
              size="sm"
              onPress={() => setWalletId(wallet.id)}
            />
          ))}
        </Row>
      </View>

      <Input
        label="Asset mint (optional)"
        value={assetMint}
        onChangeText={setAssetMint}
        placeholder="Mint address"
        mono
        autoCapitalize="none"
        autoCorrect={false}
      />

      {create.isError ? (
        <Text variant="caption" tone="danger">
          {errorMessage(create.error)}
        </Text>
      ) : null}

      <Row gap={spacing.md}>
        <Button label="Record" variant="primary" loading={create.isPending} onPress={submit} />
        <Button label="Cancel" variant="tertiary" onPress={onClose} />
      </Row>
    </Stack>
  );
}

const styles = {
  flex: { flex: 1 },
  shortcuts: { marginTop: spacing.sm },
} as const;