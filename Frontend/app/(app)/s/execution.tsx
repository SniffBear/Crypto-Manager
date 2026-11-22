import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { StatusBadge } from '@/components/StatusBadge';
import { WalletSelector, useSelectedWallet } from '@/components/context/WalletSelector';
import { ErrorState, NoticeBanner } from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useExecuteTransfer,
  useExecutionRecords,
  useSimulateTransfer,
  useSwapExecute,
  useSwapSimulate,
  useSwapQuote,
  useWallets,
} from '@/hooks/useApi';
import { useWalletContext, ALL_WALLETS } from '@/stores/wallet-context';
import { formatNumber } from '@/utils/format';

export default function ExecutionScreen() {
  const { selected } = useSelectedWallet();
  const selectedWalletId = useWalletContext((s) => s.selectedWalletId);
  const wallets = useWallets();
  const records = useExecutionRecords();
  const simulate = useSimulateTransfer();
  const execute = useExecuteTransfer();
  const quote = useSwapQuote();
  const swapSimulate = useSwapSimulate();
  const swapExecute = useSwapExecute();

  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [assetMint, setAssetMint] = useState('');
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [confirmNewRecipient, setConfirmNewRecipient] = useState(false);
  const [inputMint, setInputMint] = useState('So11111111111111111111111111111111111111112');
  const [outputMint, setOutputMint] = useState('');
  const [swapAmount, setSwapAmount] = useState('');

  usePageMeta({
    title: 'Execution center',
    subtitle: 'Simulation-first Solana execution with explicit state transitions',
    breadcrumbs: [{ label: 'Menu' }, { label: 'Execution' }],
  });

  const walletId = selectedWalletId !== ALL_WALLETS ? selectedWalletId : selected?.id ?? null;
  const selectedRecords = useMemo(
    () => (records.data ?? []).filter((record) => !walletId || record.wallet_id === walletId),
    [records.data, walletId],
  );

  const canTransfer =
    Boolean(walletId) &&
    Boolean(destination.trim()) &&
    Number(amount) > 0 &&
    !simulate.isPending &&
    !execute.isPending;

  const canSwap =
    Boolean(walletId) &&
    Boolean(inputMint.trim()) &&
    Boolean(outputMint.trim()) &&
    Number(swapAmount) > 0;

  const runSimulation = () => {
    if (!walletId) return;
    simulate.mutate(
      {
        wallet_id: walletId,
        destination: destination.trim(),
        amount: Number(amount),
        asset_mint: assetMint.trim() || null,
      },
      { onSuccess: (result) => setSimulationId(result.simulation_id) },
    );
  };

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Execution center"
          subtitle="Every action records its state. Live broadcast remains disabled unless explicitly enabled on the backend."
        />

        <WalletSelector variant="inline" />

        {!walletId ? (
          <NoticeBanner
            tone="warning"
            title="Select one wallet"
            message="Execution requires one specific signing wallet. 'All wallets' is not an executable context."
          />
        ) : null}

        <Card variant="elevated">
          <Stack gap={spacing.xl}>
            <Row justify="space-between" align="center" wrap>
              <View>
                <Text variant="h3">Native SOL transfer</Text>
                <Text variant="caption" tone="muted">
                  construct → simulate → sign → broadcast → confirm
                </Text>
              </View>
              <StatusBadge status="simulation" label="SIMULATION FIRST" />
            </Row>

            <Input
              label="Destination"
              value={destination}
              onChangeText={setDestination}
              placeholder="Solana address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Asset mint (optional)"
              value={assetMint}
              onChangeText={setAssetMint}
              placeholder="Leave blank for SOL"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label={assetMint ? 'Amount (token units)' : 'Amount (SOL)'}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <Button
              label={confirmNewRecipient ? 'New-recipient address reviewed' : 'Confirm new / untrusted recipient'}
              variant="secondary"
              onPress={() => setConfirmNewRecipient((value) => !value)}
            />
            <Text variant="caption" tone="muted">
              Keep this off unless you have independently verified the exact destination address. The backend enforces this confirmation when the address is unknown or not trusted.
            </Text>

            <Row gap={spacing.md} wrap>
              <Button
                label="Simulate transfer"
                variant="secondary"
                loading={simulate.isPending}
                disabled={!canTransfer}
                onPress={runSimulation}
              />
              <Button
                label="Broadcast simulated transfer"
                variant="destructive"
                loading={execute.isPending}
                disabled={!simulationId || execute.isPending}
                onPress={() => {
                  if (!walletId || !simulationId) return;
                  execute.mutate({
                    wallet_id: walletId,
                    destination: destination.trim(),
                    amount: Number(amount),
                    asset_mint: assetMint.trim() || null,
                    confirm: true,
                    confirm_new_recipient: confirmNewRecipient,
                    simulation_id: simulationId,
                  });
                }}
              />
            </Row>

            {simulate.isError ? (
              <ErrorState
                title="Simulation failed"
                message={errorMessage(simulate.error)}
                retryable={isRetryable(simulate.error)}
                onRetry={runSimulation}
              />
            ) : null}

            {simulate.data ? (
              <Card variant="flat">
                <Stack gap={spacing.sm}>
                  <Text variant="overline" tone="muted">Simulation</Text>
                  <Text variant="monoSmall">ID {simulate.data.simulation_id}</Text>
                  <Text variant="body" tone="secondary">Status: {simulate.data.status}</Text>
                  <Text variant="monoSmall" tone="muted">
                    Estimated fee {formatNumber(simulate.data.estimated_fee_lamports)} lamports
                  </Text>
                </Stack>
              </Card>
            ) : null}

            {execute.data ? (
              <Card variant="flat">
                <Stack gap={spacing.sm}>
                  <Text variant="overline" tone="muted">Execution state</Text>
                  <Text variant="monoSmall">
                    {execute.data.state} · broadcasted={String(execute.data.broadcasted)} · confirmed={String(execute.data.confirmed)}
                  </Text>
                  {execute.data.signature ? (
                    <Text variant="monoSmall" tone="secondary">{execute.data.signature}</Text>
                  ) : null}
                  {execute.data.reason ? (
                    <Text variant="caption" tone="muted">{execute.data.reason}</Text>
                  ) : null}
                </Stack>
              </Card>
            ) : null}

            <NoticeBanner
              tone="neutral"
              title="Token transfer safety"
              message="Standard SPL and supported Token-2022 transfers use the synchronized source token account and create the destination associated token account when needed. Transfer-hook, confidential and other unsupported Token-2022 extensions remain gated."
            />
          </Stack>
        </Card>

        <Card variant="elevated">
          <Stack gap={spacing.xl}>
            <Row justify="space-between" align="center" wrap>
              <View>
                <Text variant="h3">Jupiter swap</Text>
                <Text variant="caption" tone="muted">
                  quote → build → simulate → optional live execute
                </Text>
              </View>
              <StatusBadge status="provider" label="JUPITER" />
            </Row>

            <Input
              label="Input mint"
              value={inputMint}
              onChangeText={setInputMint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Output mint"
              value={outputMint}
              onChangeText={setOutputMint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Raw token amount"
              value={swapAmount}
              onChangeText={setSwapAmount}
              keyboardType="number-pad"
            />

            <Row gap={spacing.md} wrap>
              <Button
                label="Get quote"
                variant="tertiary"
                disabled={!canSwap || quote.isPending}
                loading={quote.isPending}
                onPress={() =>
                  walletId &&
                  quote.mutate({
                    wallet_id: walletId,
                    input_mint: inputMint.trim(),
                    output_mint: outputMint.trim(),
                    amount: Number(swapAmount),
                    slippage_bps: 50,
                  })
                }
              />
              <Button
                label="Simulate swap"
                variant="secondary"
                disabled={!canSwap || swapSimulate.isPending}
                loading={swapSimulate.isPending}
                onPress={() =>
                  walletId &&
                  swapSimulate.mutate({
                    wallet_id: walletId,
                    input_mint: inputMint.trim(),
                    output_mint: outputMint.trim(),
                    amount: Number(swapAmount),
                    slippage_bps: 50,
                  })
                }
              />
              <Button
                label="Execute swap"
                variant="destructive"
                disabled={!canSwap || swapExecute.isPending}
                loading={swapExecute.isPending}
                onPress={() =>
                  walletId &&
                  swapExecute.mutate({
                    wallet_id: walletId,
                    input_mint: inputMint.trim(),
                    output_mint: outputMint.trim(),
                    amount: Number(swapAmount),
                    slippage_bps: 50,
                    confirm: true,
                  })
                }
              />
            </Row>

            {quote.data ? (
              <Card variant="flat">
                <Text variant="monoSmall" numberOfLines={8}>
                  {JSON.stringify(quote.data, null, 2)}
                </Text>
              </Card>
            ) : null}

            {swapSimulate.data ? (
              <Card variant="flat">
                <Stack gap={spacing.sm}>
                  <StatusBadge
                    status={swapSimulate.data.ok ? 'confirmed' : 'danger'}
                    label={swapSimulate.data.status}
                  />
                  <Text variant="caption" tone="secondary">{swapSimulate.data.message}</Text>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        </Card>

        <View>
          <SectionHeader
            title="Execution history"
            subtitle={`${selectedRecords.length} records for the current wallet context`}
          />
          <Card variant="elevated" style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              {records.isError ? (
                <ErrorState
                  title="Execution history unavailable"
                  message={errorMessage(records.error)}
                  retryable={isRetryable(records.error)}
                  onRetry={() => void records.refetch()}
                />
              ) : selectedRecords.length === 0 ? (
                <Text variant="body" tone="muted">No execution records yet.</Text>
              ) : (
                selectedRecords.slice(0, 25).map((record) => (
                  <Row key={record.id} justify="space-between" align="flex-start" gap={spacing.lg}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text variant="label">{record.state}</Text>
                      <Text variant="monoSmall" tone="muted">{record.signature ?? record.id}</Text>
                    </View>
                    <Text variant="monoSmall" tone="secondary">{record.amount ?? '—'}</Text>
                  </Row>
                ))
              )}
            </Stack>
          </Card>
        </View>
        <Text variant="caption" tone="muted">
          Live execution requires ENABLE_LIVE_EXECUTION=true on the backend.
        </Text>
      </Stack>
    </PageContainer>
  );
}