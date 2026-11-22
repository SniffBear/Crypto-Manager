import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';

import { api } from '@/api/client';
import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { EmptyState, NoticeBanner } from '@/components/feedback/states';

export default function ReconciliationScreen() {
  const qc = useQueryClient();
  const latest = useQuery({ queryKey: ['reconciliation'], queryFn: () => api.reconciliation.latest(), refetchInterval: 30_000 });
  const history = useQuery({ queryKey: ['reconciliation-history'], queryFn: () => api.reconciliation.history(50) });
  const run = useMutation({ mutationFn: api.reconciliation.run, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['reconciliation'] }); void qc.invalidateQueries({ queryKey: ['reconciliation-history'] }); void qc.invalidateQueries({ queryKey: ['assets'] }); void qc.invalidateQueries({ queryKey: ['activity'] }); } });

  usePageMeta({ title: 'Portfolio reconciliation', subtitle: 'Read-only blockchain balance and activity verification', breadcrumbs: [{ label: 'Services' }, { label: 'Reconciliation' }] });
  const report = latest.data;

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader title="Portfolio reconciliation" subtitle="Refresh chain balances, discover wallet activity and record an auditable reconciliation snapshot." />
        <NoticeBanner tone="warning" title="Current network coverage: Solana only" message="The existing backend sync adapter queries Solana RPC. Other cryptocurrency networks are not reconciled until their own native adapters are implemented and configured. Reconciliation is read-only and never signs or broadcasts transactions." />
        <Card>
          <Stack gap={spacing.md}>
            <Row align="center" justify="space-between">
              <View style={{ flex: 1, gap: 4 }}><Text variant="h3">Latest reconciliation</Text><Text variant="caption" tone="muted">{report?.reconciled_at ? new Date(report.reconciled_at).toLocaleString() : 'No reconciliation has run yet'}</Text></View>
              <Button label={run.isPending ? 'Reconciling…' : 'Reconcile now'} disabled={run.isPending} onPress={() => run.mutate()} />
            </Row>
            <Divider />
            <Row justify="space-between"><Text tone="muted">Status</Text><Text variant="mono">{report?.status ?? 'NOT RUN'}</Text></Row>
            <Row justify="space-between"><Text tone="muted">Wallets checked</Text><Text variant="mono">{report?.wallet_count ?? 0}</Text></Row>
            <Row justify="space-between"><Text tone="muted">New transactions</Text><Text variant="mono">{report?.new_transactions_detected ?? 0}</Text></Row>
            <Row justify="space-between"><Text tone="muted">Mode</Text><Text variant="mono">READ ONLY</Text></Row>
          </Stack>
        </Card>
        <View>
          <SectionHeader title="Wallet balances" subtitle="Amounts are taken from the latest successful RPC wallet sync." />
          <Stack gap={spacing.md} style={{ marginTop: spacing.md }}>
            {(report?.wallets ?? []).length === 0 ? <EmptyState title="No reconciliation data" hint="Unlock the vault, configure a Solana RPC endpoint, and run reconciliation." /> : report.wallets.map((wallet: any) => (
              <Card key={wallet.wallet_id}>
                <Stack gap={spacing.sm}>
                  <Text variant="h3">{wallet.wallet_label}</Text>
                  <Text variant="caption" tone="muted">{wallet.network} · {wallet.balance_status ?? 'UNKNOWN'} balances · {wallet.new_transactions_detected} new transaction(s)</Text>
                  {Object.entries(wallet.balances ?? {}).map(([assetId, balance]: [string, any]) => <Row key={assetId} justify="space-between"><Text variant="mono">{balance.symbol ?? assetId}</Text><Text variant="mono">{balance.amount ?? '—'}</Text></Row>)}
                  {wallet.balance_changes_since_previous_reconciliation?.length ? <><Divider /><Text variant="label">Balance changes since last run</Text>{wallet.balance_changes_since_previous_reconciliation.map((change: any) => <Row key={change.asset_id} justify="space-between"><Text variant="caption">{change.asset_id}</Text><Text variant="mono" tone={change.delta >= 0 ? 'success' : 'warning'}>{change.delta > 0 ? '+' : ''}{change.delta}</Text></Row>)}</> : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        </View>
        <View>
          <SectionHeader title="Reconciliation history" />
          <Stack gap={spacing.sm} style={{ marginTop: spacing.md }}>
            {(history.data ?? []).length === 0 ? <Text tone="muted">No previous snapshots.</Text> : (history.data ?? []).map((item: any, index: number) => <Card key={`${item.reconciled_at}-${index}`}><Row justify="space-between"><Text variant="mono">{new Date(item.reconciled_at).toLocaleString()}</Text><Text variant="label">{item.status}</Text></Row><Text variant="caption" tone="muted">{item.wallet_count} wallet(s) · {item.new_transactions_detected} new transaction(s)</Text></Card>)}
          </Stack>
        </View>
      </Stack>
    </PageContainer>
  );
}