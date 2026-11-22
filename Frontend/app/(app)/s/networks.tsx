import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Chip, Divider, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { NoticeBanner } from '@/components/feedback/states';
import { StatusBadge } from '@/components/StatusBadge';
import { useConfirmDialog } from '@/components/feedback/confirmation-context';
import { toast } from '@/stores/toast';
import type { ChainNetwork } from '@/api/types';

const FAMILIES = [
  { key: 'all', label: 'All' },
  { key: 'solana', label: 'Solana' },
  { key: 'evm', label: 'EVM' },
  { key: 'utxo', label: 'UTXO' },
  { key: 'ergo', label: 'Ergo' },
  { key: 'kaspa', label: 'Kaspa' },
  { key: 'privacy_rpc', label: 'Privacy' },
] as const;

function errorText(error: any): string {
  return error?.userMessage ?? error?.message ?? 'The request could not be completed.';
}

export default function NetworksScreen() {
  const qc = useQueryClient();
  const { confirm } = useConfirmDialog();
  const [family, setFamily] = useState<string>('all');
  const [selectedId, setSelectedId] = useState('ethereum-mainnet');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('Watch wallet');
  const [providerUrl, setProviderUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  usePageMeta({
    title: 'Blockchains & Networks',
    subtitle: 'Multi-chain watch-only wallets and read-only synchronization',
    breadcrumbs: [{ label: 'Networks' }],
  });

  const networks = useQuery({
    queryKey: ['chain-networks'],
    queryFn: () => api.chains.list(),
  });
  const wallets = useQuery({
    queryKey: ['wallets'],
    queryFn: () => api.wallets.list(),
  });
  const chainPortfolio = useQuery({
    queryKey: ['chain-portfolio'],
    queryFn: () => api.chains.portfolio(),
  });
  const provider = useQuery({
    queryKey: ['chain-provider', selectedId],
    queryFn: () => api.chains.provider(selectedId),
    enabled: Boolean(selectedId),
  });

  const selected = (networks.data ?? []).find((item) => item.id === selectedId) as ChainNetwork | undefined;
  const visibleNetworks = useMemo(
    () => (networks.data ?? []).filter((item) => family === 'all' || item.family === family),
    [networks.data, family],
  );
  const selectedWallets = (wallets.data ?? []).filter((wallet) =>
    (wallet.network_id ?? (wallet.chain === 'solana' ? 'solana-mainnet-beta' : '')) === selectedId,
  );

  const validate = useMutation({
    mutationFn: () => api.chains.validateAddress(selectedId, address.trim()),
  });
  const importWatch = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a network first');
      return api.wallets.importWatchOnly({
        address: address.trim(),
        label: label.trim(),
        chain: selected.chain,
        network: selected.network,
      });
    },
    onSuccess: async (wallet) => {
      setAddress('');
      validate.reset();
      await qc.invalidateQueries({ queryKey: ['wallets'] });
      toast.success('Watch-only wallet added', wallet.address);
    },
  });
  const saveProvider = useMutation({
    mutationFn: () => api.chains.configureProvider(selectedId, {
      base_url: providerUrl.trim(),
      api_key: apiKey.trim() || undefined,
      username: username.trim() || undefined,
      password: password || undefined,
    }),
    onSuccess: async () => {
      setApiKey('');
      setPassword('');
      await qc.invalidateQueries({ queryKey: ['chain-provider', selectedId] });
      toast.success('Network provider saved');
    },
  });
  const syncWallet = useMutation({
    mutationFn: (walletId: string) => api.chains.syncWallet(selectedId, walletId),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['wallets'] });
      await qc.invalidateQueries({ queryKey: ['chain-portfolio'] });
      toast.success('Wallet synchronized', result.balance == null ? 'Balance unavailable' : result.balance + ' ' + result.native_asset);
    },
  });

  const selectNetwork = (item: ChainNetwork) => {
    setSelectedId(item.id);
    setAddress('');
    validate.reset();
    setProviderUrl(item.default_endpoint ?? '');
    setApiKey('');
    setUsername('');
    setPassword('');
  };

  const onImport = async () => {
    if (!selected || !validate.data?.valid || !label.trim()) return;
    const ok = await confirm({
      title: 'Add watch-only wallet?',
      message: 'This stores only the public address. Nexus will not create, import or store signing keys for this wallet.',
      details: ['No private key or seed phrase is involved.', 'New-chain transaction signing and broadcasting remain disabled.'],
      confirmLabel: 'Add watch-only wallet',
      tone: 'warning',
    });
    if (ok) importWatch.mutate();
  };

  return (
    <PageContainer>
      <Stack gap={spacing.xl}>
        <PageHeader
          title="Blockchains & Networks"
          subtitle="Add public addresses and synchronize balances through chain-specific read adapters."
        />

        <NoticeBanner
          tone="info"
          title="Read-only multi-chain foundation"
          message="Solana keeps its existing wallet functionality. The new network adapters currently support watch-only address monitoring and read-only data where configured. Do not send funds to a newly added network until its chain-native wallet and recovery workflow is independently verified."
        />

        <Card>
          <Stack gap={spacing.md}>
            <SectionHeader title="Multi-chain portfolio" />
            <Row justify="between">
              <Text variant="caption" tone="muted">Synchronized wallets</Text>
              <Text variant="label">{chainPortfolio.data?.wallet_count ?? 0}</Text>
            </Row>
            <Text variant="caption" tone="muted">
              USD valuation is not calculated by this chain layer. Balances remain grouped by network and are never added together across different assets.
            </Text>
            {chainPortfolio.isError ? (
              <NoticeBanner tone="warning" title="Portfolio data unavailable" message={errorText(chainPortfolio.error)} />
            ) : null}
            {(chainPortfolio.data?.wallets ?? []).map((wallet) => (
              <Row key={wallet.wallet_id} justify="space-between" align="center" gap={spacing.md}>
                <Stack gap={spacing.xxs} style={{ flex: 1 }}>
                  <Text variant="label">{wallet.label || wallet.network_id}</Text>
                  <Text variant="caption" tone="muted">{wallet.network_id}</Text>
                </Stack>
                <Stack gap={spacing.xxs} align="end">
                  <Text variant="monoSmall">
                    {wallet.balance == null ? 'Unavailable' : `${wallet.balance} ${wallet.native_asset ?? ''}`}
                  </Text>
                  <StatusBadge status={wallet.status.toLowerCase()} size="sm" />
                </Stack>
              </Row>
            ))}
          </Stack>
        </Card>

        <ViewFamilyFilters
          family={family}
          setFamily={setFamily}
          count={networks.data?.length ?? 0}
        />

        <Card>
          <Stack gap={spacing.md}>
            <SectionHeader title="Available networks" />
            {networks.isLoading ? <Text tone="muted">Loading network registry…</Text> : null}
            {networks.isError ? <NoticeBanner tone="warning" title="Network registry unavailable" message={errorText(networks.error)} /> : null}
            {visibleNetworks.map((item) => (
              <Row key={item.id} justify="space-between" align="center" gap={spacing.md}>
                <Stack gap={spacing.xxs} style={{ flex: 1 }}>
                  <Text variant="label">{item.name}</Text>
                  <Text variant="caption" tone="muted">{item.id} · {item.symbol} · {item.family}</Text>
                </Stack>
                <StatusBadge status={item.status.toLowerCase()} size="sm" />
                <Button
                  label={selectedId === item.id ? 'Selected' : 'Select'}
                  variant={selectedId === item.id ? 'secondary' : 'tertiary'}
                  size="sm"
                  onPress={() => selectNetwork(item)}
                />
              </Row>
            ))}
          </Stack>
        </Card>

        {selected ? (
          <>
            <Card variant="elevated">
              <Stack gap={spacing.lg}>
                <SectionHeader title={selected.name} />
                <Row justify="between">
                  <Text variant="caption" tone="muted">Native asset</Text>
                  <Text variant="label">{selected.symbol}</Text>
                </Row>
                <Row justify="between">
                  <Text variant="caption" tone="muted">Network ID</Text>
                  <Text variant="monoSmall">{selected.id}</Text>
                </Row>
                <Row justify="between">
                  <Text variant="caption" tone="muted">Read provider</Text>
                  <Text variant="label">{selected.provider_kind}</Text>
                </Row>
                <Row gap={spacing.xs} wrap>
                  {selected.capabilities.map((capability) => (
                    <Chip key={capability} label={capability.replace(/_/g, ' ')} selected={false} />
                  ))}
                </Row>
                <Divider />
                <SectionHeader title="Add watch-only address" />
                <Input label="Wallet label" value={label} onChangeText={setLabel} placeholder="e.g. BTC cold storage" />
                <Input
                  label="Public address"
                  value={address}
                  onChangeText={(value) => {
                    setAddress(value);
                    validate.reset();
                  }}
                  placeholder="Paste the public address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {validate.isError ? <NoticeBanner tone="warning" title="Address validation failed" message={errorText(validate.error)} /> : null}
                {validate.data ? (
                  <NoticeBanner
                    tone={validate.data.valid ? 'info' : 'warning'}
                    title={validate.data.valid ? 'Address format accepted' : 'Address not accepted'}
                    message={validate.data.reason ?? validate.data.format}
                  />
                ) : null}
                <Row gap={spacing.sm} wrap>
                  <Button
                    label="Validate address"
                    variant="secondary"
                    loading={validate.isPending}
                    disabled={!address.trim()}
                    onPress={() => validate.mutate()}
                  />
                  <Button
                    label="Add watch-only wallet"
                    variant="primary"
                    loading={importWatch.isPending}
                    disabled={!validate.data?.valid || !label.trim()}
                    onPress={() => void onImport()}
                  />
                </Row>
                {importWatch.isError ? <NoticeBanner tone="warning" title="Wallet was not added" message={errorText(importWatch.error)} /> : null}
              </Stack>
            </Card>

            <Card>
              <Stack gap={spacing.md}>
                <SectionHeader title="Read provider configuration" />
                <Text variant="caption" tone="muted">
                  Provider credentials are stored inside the encrypted backend vault. The Expo app never receives a saved API key or RPC password.
                </Text>
                <Input
                  label="RPC / API base URL"
                  value={providerUrl}
                  onChangeText={setProviderUrl}
                  placeholder={selected.default_endpoint ?? 'https://your-provider.example'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input label="API key (optional)" value={apiKey} onChangeText={setApiKey} secureTextEntry autoCapitalize="none" autoCorrect={false} />
                {selected.family === 'privacy_rpc' ? (
                  <>
                    <Input label="Local wallet RPC username (optional)" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
                    <Input label="Local wallet RPC password (optional)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
                  </>
                ) : null}
                <Row justify="between" align="center">
                  <Text variant="caption" tone="muted">
                    {String(provider.data?.configured ? 'Configured' : 'Not configured')}
                  </Text>
                  <Button
                    label="Save provider"
                    variant="secondary"
                    loading={saveProvider.isPending}
                    disabled={!providerUrl.trim()}
                    onPress={() => saveProvider.mutate()}
                  />
                </Row>
                {saveProvider.isError ? <NoticeBanner tone="warning" title="Provider was not saved" message={errorText(saveProvider.error)} /> : null}
              </Stack>
            </Card>

            <Card>
              <Stack gap={spacing.md}>
                <SectionHeader title="Wallets on this network" />
                {selectedWallets.length === 0 ? (
                  <Text tone="muted">No watch-only wallets have been added to this network.</Text>
                ) : selectedWallets.map((wallet) => (
                  <Row key={wallet.id} justify="space-between" align="center" gap={spacing.md}>
                    <Stack gap={spacing.xxs} style={{ flex: 1 }}>
                      <Text variant="label">{wallet.label}</Text>
                      <Text variant="monoSmall" tone="muted">{wallet.address}</Text>
                      <Text variant="caption" tone="muted">{wallet.chain_sync_status ?? 'Not synchronized'}</Text>
                      {wallet.chain_sync?.balance != null ? (
                        <Text variant="monoSmall">{String(wallet.chain_sync.balance)} {String(wallet.chain_sync.native_asset ?? '')}</Text>
                      ) : null}
                    </Stack>
                    <Button
                      label="Sync"
                      size="sm"
                      variant="secondary"
                      loading={syncWallet.isPending}
                      onPress={() => syncWallet.mutate(wallet.id)}
                    />
                  </Row>
                ))}
                {syncWallet.isError ? <NoticeBanner tone="warning" title="Synchronization failed" message={errorText(syncWallet.error)} /> : null}
              </Stack>
            </Card>
          </>
        ) : null}
      </Stack>
    </PageContainer>
  );
}

function ViewFamilyFilters({
  family,
  setFamily,
  count,
}: {
  family: string;
  setFamily: (value: string) => void;
  count: number;
}) {
  return (
    <Stack gap={spacing.sm}>
      <SectionHeader title={`Filter networks · ${count}`} />
      <Row gap={spacing.xs} wrap>
        {FAMILIES.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={family === item.key}
            onPress={() => setFamily(item.key)}
          />
        ))}
      </Row>
    </Stack>
  );
}
