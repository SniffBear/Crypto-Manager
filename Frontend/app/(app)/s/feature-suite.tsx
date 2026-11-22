import { useMemo, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { EmptyState, NoticeBanner } from '@/components/feedback/states';

function errorText(error: any): string {
  return error?.userMessage ?? error?.message ?? 'The request could not be completed.';
}

export default function FeatureSuiteScreen() {
  const qc = useQueryClient();
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: () => api.wallets.list() });
  const groups = useQuery({ queryKey: ['feature-groups'], queryFn: () => api.featureSuite.groups() });
  const policy = useQuery({ queryKey: ['feature-policy'], queryFn: () => api.featureSuite.policy() });
  const schedules = useQuery({ queryKey: ['feature-schedules'], queryFn: () => api.featureSuite.schedules() });
  const batches = useQuery({ queryKey: ['feature-batches'], queryFn: () => api.featureSuite.batches() });
  const costBasis = useQuery({ queryKey: ['feature-cost-basis'], queryFn: () => api.featureSuite.costBasis() });
  const costEntries = useQuery({ queryKey: ['feature-cost-entries'], queryFn: () => api.featureSuite.costBasisEntries() });
  const paymentRequests = useQuery({ queryKey: ['feature-payment-requests'], queryFn: () => api.featureSuite.paymentRequests() });
  const security = useQuery({ queryKey: ['feature-security'], queryFn: () => api.featureSuite.securityCenter() });
  const securityAlerts = useQuery({ queryKey: ['feature-security-alerts'], queryFn: () => api.featureSuite.securityAlerts() });
  const recoveryChecklist = useQuery({ queryKey: ['feature-recovery-checklist'], queryFn: () => api.featureSuite.recoveryChecklist() });
  const backupInventory = useQuery({ queryKey: ['feature-backup-inventory'], queryFn: () => api.featureSuite.backupInventory(false) });
  const networkCapabilities = useQuery({ queryKey: ['feature-network-capabilities'], queryFn: () => api.featureSuite.networkCapabilities() });
  const exchangeHistory = useQuery({ queryKey: ['feature-exchange-history'], queryFn: () => api.featureSuite.exchangeHistory() });
  const audit = useQuery({ queryKey: ['feature-audit'], queryFn: () => api.featureSuite.auditLog(30) });
  const devices = useQuery({ queryKey: ['feature-devices'], queryFn: () => api.featureSuite.devices() });
  const backupPolicy = useQuery({ queryKey: ['feature-backup-policy'], queryFn: () => api.featureSuite.backupPolicy() });
  const limitOrders = useQuery({ queryKey: ['feature-limit-orders'], queryFn: () => api.featureSuite.limitOrders() });
  const graph = useQuery({ queryKey: ['feature-wallet-graph'], queryFn: () => api.featureSuite.walletGraph() });
  const fees = useQuery({ queryKey: ['feature-fees'], queryFn: () => api.featureSuite.fees() });
  const analytics = useQuery({ queryKey: ['feature-portfolio-analytics'], queryFn: () => api.featureSuite.portfolioAnalytics() });

  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groupWalletId, setGroupWalletId] = useState('');
  const [scheduleWallet, setScheduleWallet] = useState('');
  const [scheduleDestination, setScheduleDestination] = useState('');
  const [scheduleAmount, setScheduleAmount] = useState('');
  const [scheduleTime, setScheduleTime] = useState(new Date(Date.now() + 60 * 60 * 1000).toISOString());
  const [scheduleRecurrence, setScheduleRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [policyPerTx, setPolicyPerTx] = useState('');
  const [policyDaily, setPolicyDaily] = useState('');
  const [policyCooldown, setPolicyCooldown] = useState('0');
  const [policyMaxFeeRatio, setPolicyMaxFeeRatio] = useState('10');
  const [policyHighValue, setPolicyHighValue] = useState('');
  const [batchWallet, setBatchWallet] = useState('');
  const [batchDestination, setBatchDestination] = useState('');
  const [batchAmount, setBatchAmount] = useState('');
  const [ledgerKind, setLedgerKind] = useState<'acquisition' | 'disposal'>('acquisition');
  const [ledgerAsset, setLedgerAsset] = useState('BTC');
  const [ledgerQuantity, setLedgerQuantity] = useState('');
  const [ledgerPrice, setLedgerPrice] = useState('');
  const [paymentAddress, setPaymentAddress] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAsset, setPaymentAsset] = useState('SOL');
  const [assistantQuestion, setAssistantQuestion] = useState('What is my portfolio worth?');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [limitSide, setLimitSide] = useState<'buy' | 'sell'>('buy');
  const [limitAsset, setLimitAsset] = useState('SOL');
  const [limitPrice, setLimitPrice] = useState('');
  const [limitQuantity, setLimitQuantity] = useState('');
  const [clipboardExpected, setClipboardExpected] = useState('');
  const [explorerNetwork, setExplorerNetwork] = useState('solana');
  const [explorerKind, setExplorerKind] = useState('tx');
  const [explorerId, setExplorerId] = useState('');
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [syncBundle, setSyncBundle] = useState('');
  const [verifiedBackups, setVerifiedBackups] = useState<any[] | null>(null);

  const invalidate = (...keys: string[]) => keys.forEach((key) => void qc.invalidateQueries({ queryKey: [key] }));
  const createGroup = useMutation({ mutationFn: api.featureSuite.createGroup, onSuccess: () => { setGroupName(''); invalidate('feature-groups'); } });
  const assignGroup = useMutation({ mutationFn: ({ id, walletIds }: { id: string; walletIds: string[] }) => api.featureSuite.setGroupMembers(id, walletIds), onSuccess: () => invalidate('feature-groups') });
  const setPolicy = useMutation({ mutationFn: api.featureSuite.setPolicy, onSuccess: () => invalidate('feature-policy') });
  const createSchedule = useMutation({ mutationFn: api.featureSuite.createSchedule, onSuccess: () => invalidate('feature-schedules') });
  const createBatch = useMutation({ mutationFn: api.featureSuite.createBatch, onSuccess: () => invalidate('feature-batches') });
  const addCostEntry = useMutation({ mutationFn: api.featureSuite.addCostBasisEntry, onSuccess: () => { invalidate('feature-cost-basis', 'feature-cost-entries'); } });
  const createPayment = useMutation({ mutationFn: api.featureSuite.createPaymentRequest, onSuccess: () => { setPaymentAddress(''); setPaymentAmount(''); invalidate('feature-payment-requests'); } });
  const ask = useMutation({ mutationFn: api.featureSuite.askAssistant, onSuccess: (result) => setAssistantAnswer(result.answer) });
  const createLimit = useMutation({ mutationFn: api.featureSuite.createLimitOrder, onSuccess: () => invalidate('feature-limit-orders') });
  const setBackup = useMutation({ mutationFn: api.featureSuite.setBackupPolicy, onSuccess: () => invalidate('feature-backup-policy') });
  const acknowledgeAlert = useMutation({ mutationFn: api.featureSuite.acknowledgeSecurityAlert, onSuccess: () => invalidate('feature-security-alerts', 'feature-audit') });
  const exportSync = useMutation({ mutationFn: api.featureSuite.metadataExport, onSuccess: async (result) => { setSyncBundle(result.bundle); try { await setStringAsync(result.bundle); Alert.alert('Encrypted export created', 'The metadata-only sync bundle was also copied to your clipboard. It contains no private keys.'); } catch { Alert.alert('Export created', 'Copy or save the encrypted bundle securely.'); } } });
  const importSync = useMutation({ mutationFn: () => api.featureSuite.metadataImport(syncBundle, syncPassphrase, true), onSuccess: () => { Alert.alert('Metadata imported', 'Vault metadata was merged. Wallet private keys were not included.'); invalidate('address-book', 'feature-groups', 'feature-policy', 'feature-payment-requests'); } });

  const walletRows = useMemo(() => wallets.data ?? [], [wallets.data]);
  const currentPolicy = policy.data ?? {};
  usePageMeta({ title: 'Nexus feature suite', subtitle: 'Transaction controls, accounting intelligence and vault utilities', breadcrumbs: [{ label: 'System' }, { label: 'Feature Suite' }] });

  const verifyClipboard = async () => {
    if (!clipboardExpected.trim()) return Alert.alert('Address required', 'Enter the destination you intend to use first.');
    try {
      const clipboard = (await getStringAsync()).trim();
      if (clipboard === clipboardExpected.trim()) Alert.alert('Clipboard matches', 'The copied address exactly matches your expected destination.');
      else Alert.alert('Clipboard mismatch', 'The clipboard contents differ from the destination you entered. Do not send until you independently verify the address.');
    } catch { Alert.alert('Clipboard unavailable', 'The application could not read clipboard contents.'); }
  };

  const openExplorer = async () => {
    try {
      const result = await api.featureSuite.explorer(explorerNetwork, explorerKind, explorerId.trim());
      await Linking.openURL(result.url);
    } catch (error) { Alert.alert('Explorer link unavailable', errorText(error)); }
  };

  const loadSyncBundleFromClipboard = async () => {
    try { setSyncBundle(await getStringAsync()); }
    catch { Alert.alert('Clipboard unavailable', 'Paste the encrypted bundle into the text field.'); }
  };

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader title="Nexus feature suite" subtitle="Manage wallet organization, spending policy, scheduled payment intents, accounting, payment requests and security." />
        <NoticeBanner tone="warning" title="No hardware wallet integration" message="Hardware-wallet integration is intentionally excluded. Scheduled transfers, limit orders and batch transfers are planning/review tools only; none can automatically sign or broadcast transactions." />

        <View>
          <SectionHeader title="Wallet groups" subtitle="Organize wallets into spending, savings, trading or custom groups." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="GROUP NAME" value={groupName} onChangeText={setGroupName} placeholder="e.g. Long-term savings" />
              <Button label={createGroup.isPending ? 'Creating…' : 'Create group'} disabled={!groupName.trim() || createGroup.isPending} onPress={() => createGroup.mutate({ name: groupName }, { onError: (e) => Alert.alert('Could not create group', errorText(e)) })} />
              {groups.data?.length ? groups.data.map((group: any) => <Row key={group.id} justify="space-between" align="center"><View style={{ flex: 1, gap: 2 }}><Text variant="label">{group.name}</Text><Text variant="caption" tone="muted">{group.wallet_count} wallet(s) · {group.description || 'No description'}</Text></View><Button size="sm" variant="tertiary" label="Delete" onPress={() => Alert.alert('Delete group?', group.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => api.featureSuite.deleteGroup(group.id).then(() => invalidate('feature-groups')).catch((e) => Alert.alert('Error', errorText(e))) }])} /></Row>) : <Text variant="caption" tone="muted">No groups have been created.</Text>}
              <Divider />
              <Input label="GROUP ID" value={groupId} onChangeText={setGroupId} placeholder={groups.data?.[0]?.id ?? 'Select a group ID'} autoCapitalize="none" />
              <Input label="WALLET ID TO INCLUDE" value={groupWalletId} onChangeText={setGroupWalletId} placeholder={walletRows[0]?.id ?? 'Wallet ID'} autoCapitalize="none" />
              <Button size="sm" variant="secondary" label="Add wallet to group" disabled={!groupId.trim() || !groupWalletId.trim() || assignGroup.isPending} onPress={() => { const selected = groups.data?.find((x: any) => x.id === groupId); const ids = [...new Set([...(selected?.wallet_ids ?? []), groupWalletId])]; assignGroup.mutate({ id: groupId, walletIds: ids }, { onSuccess: () => setGroupWalletId(''), onError: (e) => Alert.alert('Could not update group', errorText(e)) }); }} />
              <Text variant="caption" tone="muted">Groups only organize wallet references; they do not move funds or alter ownership.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Transaction policy" subtitle="Rules are evaluated before a transaction is simulated or approved." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Row justify="space-between" align="center"><View style={{ flex: 1 }}><Text variant="label">Confirm unknown recipients</Text><Text variant="caption" tone="muted">Require explicit confirmation for new or untrusted addresses.</Text></View><Button size="sm" variant="secondary" label={currentPolicy.require_new_recipient_confirmation === false ? 'Off' : 'On'} onPress={() => setPolicy.mutate({ require_new_recipient_confirmation: currentPolicy.require_new_recipient_confirmation === false }, { onError: (e) => Alert.alert('Policy update failed', errorText(e)) })} /></Row>
              <Divider />
              <Row justify="space-between" align="center"><View style={{ flex: 1 }}><Text variant="label">Trusted recipients only</Text><Text variant="caption" tone="muted">Block sends to addresses that are not marked trusted.</Text></View><Button size="sm" variant="secondary" label={currentPolicy.require_trusted_recipient ? 'On' : 'Off'} onPress={() => setPolicy.mutate({ require_trusted_recipient: !currentPolicy.require_trusted_recipient }, { onError: (e) => Alert.alert('Policy update failed', errorText(e)) })} /></Row>
              <Divider />
              <Row justify="space-between"><Text variant="caption" tone="muted">Per-transaction cap</Text><Text variant="monoSmall">{currentPolicy.per_transaction_limit ?? 'Not set'}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Daily spend cap</Text><Text variant="monoSmall">{currentPolicy.daily_spend_limit ?? 'Not set'}</Text></Row>
              <Divider />
              <Text variant="label">ADVANCED SPENDING LIMITS</Text>
              <Input label="PER-TRANSACTION LIMIT (ASSET UNITS)" value={policyPerTx} onChangeText={setPolicyPerTx} keyboardType="decimal-pad" placeholder={currentPolicy.per_transaction_limit ?? 'No limit'} />
              <Input label="DAILY SPEND LIMIT (ASSET UNITS)" value={policyDaily} onChangeText={setPolicyDaily} keyboardType="decimal-pad" placeholder={currentPolicy.daily_spend_limit ?? 'No limit'} />
              <Input label="NEW-RECIPIENT COOLDOWN (MINUTES)" value={policyCooldown} onChangeText={setPolicyCooldown} keyboardType="number-pad" />
              <Input label="MAX FEE / AMOUNT RATIO (%)" value={policyMaxFeeRatio} onChangeText={setPolicyMaxFeeRatio} keyboardType="decimal-pad" />
              <Input label="SECOND CONFIRMATION ABOVE (ASSET UNITS)" value={policyHighValue} onChangeText={setPolicyHighValue} keyboardType="decimal-pad" placeholder={currentPolicy.require_second_confirmation_above ?? 'Disabled'} />
              <Button size="sm" variant="secondary" label="Save numerical policy" onPress={() => {
                const update: Record<string, unknown> = { recipient_cooldown_minutes: Number(policyCooldown || 0), max_fee_ratio_percent: Number(policyMaxFeeRatio || 0) };
                if (policyPerTx.trim()) update.per_transaction_limit = policyPerTx.trim();
                if (policyDaily.trim()) update.daily_spend_limit = policyDaily.trim();
                if (policyHighValue.trim()) update.require_second_confirmation_above = policyHighValue.trim();
                setPolicy.mutate(update, { onError: (e) => Alert.alert('Policy update failed', errorText(e)), onSuccess: () => Alert.alert('Policy saved', 'Limits are stored in asset units. Configure conservatively and verify the relevant asset/network before sending.') });
              }} />
              <Text variant="caption" tone="muted">Caps use raw asset units; this build does not yet support separate per-network/per-asset policy profiles. The same numeric caps should not be reused across assets with different units.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Scheduled payment intents" subtitle="Due items move to manual approval. No unattended transaction signing." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="SOURCE WALLET ID" value={scheduleWallet} onChangeText={setScheduleWallet} placeholder={walletRows[0]?.id ?? 'Wallet ID'} />
              <Input label="DESTINATION ADDRESS" value={scheduleDestination} onChangeText={setScheduleDestination} autoCapitalize="none" mono />
              <Input label="AMOUNT" value={scheduleAmount} onChangeText={setScheduleAmount} keyboardType="decimal-pad" placeholder="0.01" />
              <Input label="RUN AT (ISO 8601 WITH TIMEZONE)" value={scheduleTime} onChangeText={setScheduleTime} autoCapitalize="none" />
              <Text variant="label">RECURRENCE</Text>
              <Row gap={spacing.xs} wrap>
                {(['none', 'daily', 'weekly', 'monthly'] as const).map((value) => <Button key={value} size="sm" variant={scheduleRecurrence === value ? 'primary' : 'secondary'} label={value} onPress={() => setScheduleRecurrence(value)} />)}
              </Row>
              <Button label={createSchedule.isPending ? 'Scheduling…' : 'Create scheduled intent'} disabled={!scheduleWallet.trim() || !scheduleDestination.trim() || !scheduleAmount.trim() || createSchedule.isPending} onPress={() => createSchedule.mutate({ wallet_id: scheduleWallet, network: 'solana', destination: scheduleDestination, amount: scheduleAmount, run_at: scheduleTime, recurrence: scheduleRecurrence, asset: 'native' }, { onError: (e) => Alert.alert('Could not schedule payment', errorText(e)) })} />
              {(schedules.data ?? []).map((item: any) => <Card key={item.id} variant="flat"><Stack gap={spacing.xs}><Row justify="space-between"><Text variant="label">{item.amount} {item.asset}</Text><Text variant="caption" tone="muted">{item.status}</Text></Row><Text variant="monoSmall" numberOfLines={1}>{item.destination}</Text><Text variant="caption" tone="muted">{new Date(item.run_at).toLocaleString()} · manual approval required</Text>{item.status === 'AWAITING_MANUAL_APPROVAL' ? <Button size="sm" variant="secondary" label="Approve for manual send" onPress={() => Alert.alert('Approve scheduled intent?', 'This only moves the intent to the manual-send queue. It will not sign or broadcast.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Approve', onPress: () => api.featureSuite.approveSchedule(item.id).then(() => invalidate('feature-schedules')).catch((e) => Alert.alert('Approval failed', errorText(e))) }])} /> : null}{item.status === 'SCHEDULED' || item.status === 'AWAITING_MANUAL_APPROVAL' ? <Button size="sm" variant="tertiary" label="Cancel intent" onPress={() => api.featureSuite.cancelSchedule(item.id).then(() => invalidate('feature-schedules')).catch((e) => Alert.alert('Cancellation failed', errorText(e)))} /> : null}</Stack></Card>)}
              {!(schedules.data ?? []).length ? <Text variant="caption" tone="muted">No scheduled intents.</Text> : null}
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Batch transfer drafts" subtitle="Prepare several recipients together; each transaction still needs its own simulation and approval." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="SOURCE WALLET ID" value={batchWallet} onChangeText={setBatchWallet} placeholder={walletRows[0]?.id ?? 'Wallet ID'} />
              <Input label="DESTINATION ADDRESS" value={batchDestination} onChangeText={setBatchDestination} autoCapitalize="none" mono />
              <Input label="AMOUNT" value={batchAmount} onChangeText={setBatchAmount} keyboardType="decimal-pad" />
              <Button label="Save batch draft" disabled={!batchWallet.trim() || !batchDestination.trim() || !batchAmount.trim() || createBatch.isPending} onPress={() => createBatch.mutate({ wallet_id: batchWallet, network: 'solana', transfers: [{ destination: batchDestination, amount: batchAmount }] }, { onError: (e) => Alert.alert('Batch draft failed', errorText(e)) })} />
              {(batches.data ?? []).map((item: any) => <Text key={item.id} variant="caption" tone="muted">{item.count} item(s) · {item.total_amount} · {item.status} · not broadcast</Text>)}
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Cost basis & tax ledger" subtitle="FIFO accounting from records you enter; not a tax calculation or blockchain-imported tax ledger." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Row gap={spacing.sm}><Button size="sm" variant={ledgerKind === 'acquisition' ? 'primary' : 'secondary'} label="Acquisition" onPress={() => setLedgerKind('acquisition')} /><Button size="sm" variant={ledgerKind === 'disposal' ? 'primary' : 'secondary'} label="Disposal" onPress={() => setLedgerKind('disposal')} /></Row>
              <Input label="ASSET SYMBOL" value={ledgerAsset} onChangeText={setLedgerAsset} autoCapitalize="characters" />
              <Input label="ACQUISITION QUANTITY" value={ledgerQuantity} onChangeText={setLedgerQuantity} keyboardType="decimal-pad" />
              <Input label="UNIT PRICE / DISPOSAL PRICE (USD)" value={ledgerPrice} onChangeText={setLedgerPrice} keyboardType="decimal-pad" />
              <Button label={ledgerKind === 'acquisition' ? 'Record acquisition lot' : 'Record FIFO disposal'} disabled={!ledgerAsset.trim() || !ledgerQuantity.trim() || !ledgerPrice.trim() || addCostEntry.isPending} onPress={() => addCostEntry.mutate({ kind: ledgerKind, asset: ledgerAsset, quantity: ledgerQuantity, unit_price_usd: ledgerPrice, fee_usd: '0', description: `Manual ${ledgerKind} entry` }, { onError: (e) => Alert.alert('Ledger entry failed', errorText(e)) })} />
              <Divider />
              <Text variant="label">FIFO summary</Text>
              {Object.entries(costBasis.data?.assets ?? {}).map(([asset, values]: [string, any]) => <Stack key={asset} gap={2}><Row justify="space-between"><Text variant="caption">{asset} · {values.quantity}</Text><Text variant="monoSmall">Basis ${Number(values.remaining_cost_basis_usd).toLocaleString()}</Text></Row><Text variant="caption" tone="muted">Realized ${Number(values.realized_gain_loss_usd).toLocaleString()} · Unrealized {values.unrealized_gain_loss_usd == null ? 'price unavailable' : `$${Number(values.unrealized_gain_loss_usd).toLocaleString()}`}</Text></Stack>)}
              <Text variant="caption" tone="muted">{costBasis.data?.warning ?? 'No ledger entries yet.'}</Text>
              <Text variant="caption" tone="muted">{(costEntries.data ?? []).length} ledger event(s)</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Payment requests" subtitle="Create an address-and-amount request and track it as open, paid or expired when matching indexed activity is available." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="RECEIVING ADDRESS" value={paymentAddress} onChangeText={setPaymentAddress} autoCapitalize="none" mono />
              <Input label="ASSET" value={paymentAsset} onChangeText={setPaymentAsset} autoCapitalize="characters" />
              <Input label="AMOUNT" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" />
              <Button label="Create payment request" disabled={!paymentAddress.trim() || !paymentAmount.trim() || createPayment.isPending} onPress={() => createPayment.mutate({ network: 'solana', asset: paymentAsset, address: paymentAddress, amount: paymentAmount, label: 'Nexus payment request' }, { onError: (e) => Alert.alert('Payment request failed', errorText(e)) })} />
              {(paymentRequests.data ?? []).map((item: any) => <Card key={item.id} variant="flat"><Row justify="space-between"><Text variant="label">{item.amount} {item.asset}</Text><Text variant="caption" tone="muted">{item.status}</Text></Row><Text variant="monoSmall" numberOfLines={2}>{item.address}</Text><Text variant="caption" tone="muted">Expires {new Date(item.expires_at).toLocaleString()}</Text></Card>)}
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Local portfolio assistant" subtitle="Read-only, rule-based answers from the vault. No external AI service receives wallet data." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="QUESTION" value={assistantQuestion} onChangeText={setAssistantQuestion} multiline />
              <Button label={ask.isPending ? 'Checking vault…' : 'Ask read-only assistant'} disabled={!assistantQuestion.trim() || ask.isPending} onPress={() => ask.mutate(assistantQuestion, { onError: (e) => Alert.alert('Assistant unavailable', errorText(e)) })} />
              {assistantAnswer ? <NoticeBanner tone="info" title="Local answer" message={assistantAnswer} /> : null}
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Limit-order alerts" subtitle="Price triggers create a manual review alert only. No order is submitted to an exchange." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Row gap={spacing.sm}><Button size="sm" variant={limitSide === 'buy' ? 'primary' : 'secondary'} label="Buy alert" onPress={() => setLimitSide('buy')} /><Button size="sm" variant={limitSide === 'sell' ? 'primary' : 'secondary'} label="Sell alert" onPress={() => setLimitSide('sell')} /></Row>
              <Input label="ASSET SYMBOL" value={limitAsset} onChangeText={setLimitAsset} autoCapitalize="characters" />
              <Input label="TARGET PRICE (USD)" value={limitPrice} onChangeText={setLimitPrice} keyboardType="decimal-pad" />
              <Input label="QUANTITY" value={limitQuantity} onChangeText={setLimitQuantity} keyboardType="decimal-pad" />
              <Button label={`Create ${limitSide} alert`} disabled={!limitAsset.trim() || !limitPrice.trim() || !limitQuantity.trim() || createLimit.isPending} onPress={() => createLimit.mutate({ asset: limitAsset, side: limitSide, target_price: limitPrice, quantity: limitQuantity }, { onError: (e) => Alert.alert('Limit alert failed', errorText(e)) })} />
              {(limitOrders.data?.orders ?? []).map((item: any) => <Text key={item.id} variant="caption" tone="muted">{item.side.toUpperCase()} {item.quantity} {item.asset} at ${item.target_price_usd} · {item.status}</Text>)}
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Clipboard address verification" subtitle="Read the clipboard only after you press the button; no background clipboard monitoring." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="EXPECTED DESTINATION ADDRESS" value={clipboardExpected} onChangeText={setClipboardExpected} autoCapitalize="none" mono />
              <Button label="Compare clipboard to expected address" variant="secondary" onPress={verifyClipboard} />
              <Text variant="caption" tone="muted">This detects a mismatch between the address you entered and the clipboard value at check time. It cannot prove the recipient owns the address.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Blockchain explorer links" subtitle="Links open third-party explorers; the app does not claim to validate their content." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="NETWORK" value={explorerNetwork} onChangeText={setExplorerNetwork} autoCapitalize="none" />
              <Input label="TYPE (tx, address, block)" value={explorerKind} onChangeText={setExplorerKind} autoCapitalize="none" />
              <Input label="IDENTIFIER" value={explorerId} onChangeText={setExplorerId} autoCapitalize="none" />
              <Button label="Open explorer" disabled={!explorerId.trim()} onPress={openExplorer} />
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Encrypted metadata sync" subtitle="Export/import contacts, groups, policies, requests and ledger metadata. Private keys are excluded." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Input label="SYNC PASSPHRASE (12+ CHARACTERS)" value={syncPassphrase} onChangeText={setSyncPassphrase} secureTextEntry />
              <Button label="Create encrypted metadata export" variant="secondary" disabled={syncPassphrase.length < 12 || exportSync.isPending} onPress={() => exportSync.mutate(syncPassphrase, { onError: (e) => Alert.alert('Export failed', errorText(e)) })} />
              <Input label="ENCRYPTED BUNDLE" value={syncBundle} onChangeText={setSyncBundle} multiline autoCapitalize="none" />
              <Row gap={spacing.sm}>
                <Button size="sm" variant="tertiary" label="Paste bundle" onPress={loadSyncBundleFromClipboard} />
                <Button size="sm" label="Import / merge" disabled={!syncBundle.trim() || syncPassphrase.length < 12 || importSync.isPending} onPress={() => importSync.mutate(undefined, { onError: (e) => Alert.alert('Import failed', errorText(e)) })} />
              </Row>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Automatic encrypted backups" subtitle="Optional periodic copies of the already-encrypted vault file." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Row justify="space-between" align="center"><View style={{ flex: 1 }}><Text variant="label">Automatic backups</Text><Text variant="caption" tone="muted">{backupPolicy.data?.automatic_backups_enabled ? 'Enabled' : 'Disabled'}</Text></View><Button size="sm" variant="secondary" label={backupPolicy.data?.automatic_backups_enabled ? 'Disable' : 'Enable'} onPress={() => setBackup.mutate({ automatic_backups_enabled: !backupPolicy.data?.automatic_backups_enabled, interval_hours: backupPolicy.data?.interval_hours ?? 24, retention_count: backupPolicy.data?.retention_count ?? 14 }, { onError: (e) => Alert.alert('Backup setting failed', errorText(e)) })} /></Row>
              <Text variant="caption" tone="muted">Interval: every {backupPolicy.data?.interval_hours ?? 24} hour(s) · Retain {backupPolicy.data?.retention_count ?? 14} backups. The maintenance worker only runs while the vault is unlocked.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Security center & audit trail" subtitle="Local vault security posture and recent sensitive actions." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.sm}>
              <Row justify="space-between"><Text variant="caption" tone="muted">Wallets</Text><Text variant="monoSmall">{security.data?.wallet_count ?? '—'}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Watch-only wallets</Text><Text variant="monoSmall">{security.data?.watch_only_wallets ?? '—'}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Signing enabled</Text><Text variant="monoSmall">{security.data?.signing_enabled_wallets ?? '—'}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Trusted recipients</Text><Text variant="monoSmall">{security.data?.trusted_recipients ?? '—'}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Encrypted backups</Text><Text variant="monoSmall">{security.data?.backup_count ?? '—'}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Hardware wallets</Text><Text variant="monoSmall">Not integrated</Text></Row>
              <Divider />
              {(audit.data ?? []).slice(0, 8).map((item: any) => <Row key={item.id} justify="space-between"><Text variant="caption">{item.action}</Text><Text variant="caption" tone="muted">{new Date(item.created_at).toLocaleString()}</Text></Row>)}
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Security alert center" subtitle="Conservative review signals from local execution records. These are not fraud verdicts." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              {(securityAlerts.data ?? []).length ? (securityAlerts.data ?? []).map((item: any) => (
                <Stack key={item.id} gap={spacing.xs}>
                  <Row justify="space-between" align="center">
                    <Text variant="label">{item.title}</Text>
                    <Text variant="caption" tone={item.severity === 'high' ? 'danger' : 'muted'}>{item.severity.toUpperCase()}</Text>
                  </Row>
                  <Text variant="caption" tone="muted">{item.detail}</Text>
                  <Button size="sm" variant="tertiary" label="Acknowledge alert" disabled={acknowledgeAlert.isPending} onPress={() => acknowledgeAlert.mutate(item.id, { onError: (e) => Alert.alert('Could not acknowledge alert', errorText(e)) })} />
                  <Divider />
                </Stack>
              )) : <EmptyState title="No open security alerts" hint="Review alerts after transaction activity has synchronized." />}
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Backup integrity & recovery" subtitle="Verify local encrypted backup files against their SHA-256 manifests; this does not test vault-password recovery." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Row justify="space-between"><Text variant="caption" tone="muted">Backup copies</Text><Text variant="monoSmall">{backupInventory.data?.backups?.length ?? 0}</Text></Row>
              <Button size="sm" variant="secondary" label="Verify backup hashes" onPress={() => api.featureSuite.backupInventory(true).then((result) => { setVerifiedBackups(result.backups ?? []); invalidate('feature-backup-inventory'); Alert.alert('Integrity check complete', `${(result.backups ?? []).filter((x: any) => x.integrity === 'MATCH').length} matching backup(s); ${ (result.backups ?? []).filter((x: any) => x.integrity !== 'MATCH').length} need review.`); }).catch((e) => Alert.alert('Verification failed', errorText(e)))} />
              {(verifiedBackups ?? backupInventory.data?.backups ?? []).slice(0, 5).map((item: any) => <Row key={item.name} justify="space-between"><Text variant="caption">{item.name}</Text><Text variant="caption" tone="muted">{item.integrity}</Text></Row>)}
              {(recoveryChecklist.data?.recommended_steps ?? []).map((step: string, index: number) => <Text key={index} variant="caption" tone="muted">{index + 1}. {step}</Text>)}
              <Text variant="caption" tone="muted">Restore has not been automatically tested. Test recovery with a separate vault copy before relying on a backup.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Network support matrix" subtitle="Only networks with implemented, tested adapters should be used for wallet operations." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.sm}>
              {(networkCapabilities.data ?? []).map((item: any) => <Stack key={item.network} gap={2}>
                <Row justify="space-between"><Text variant="label">{item.symbol} · {item.network}</Text><Text variant="caption" tone={item.wallet_read === 'LIVE' ? 'success' : 'muted'}>{item.wallet_read}</Text></Row>
                <Text variant="caption" tone="muted">Read: {item.wallet_read} · Send: {item.send} · Swap: {item.swap} · Reconcile: {item.reconciliation}</Text>
              </Stack>)}
              <Text variant="caption" tone="muted">The non-Solana native adapters remain explicitly unimplemented. Do not deposit funds to unsupported networks expecting this app to monitor or sign them.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Exchange & transaction history" subtitle="Currently displays local execution records and supported Solana Jupiter swap records only." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.md}>
              <Row justify="space-between"><Text variant="caption" tone="muted">Recorded swaps / quotes</Text><Text variant="monoSmall">{exchangeHistory.data?.items?.length ?? 0}</Text></Row>
              {(exchangeHistory.data?.items ?? []).slice(0, 5).map((item: any) => <Row key={item.id} justify="space-between"><Text variant="caption">{item.asset_mint ?? 'Swap'} → {item.output_mint ?? '—'}</Text><Text variant="caption" tone="muted">{item.state}</Text></Row>)}
              <Button size="sm" variant="secondary" label="Copy transaction CSV" onPress={() => api.featureSuite.transactionsCsv().then((csv) => setStringAsync(csv)).then(() => Alert.alert('CSV copied', 'Paste the transaction export into a local .csv file.')).catch((e) => Alert.alert('Export failed', errorText(e)))} />
              <Text variant="caption" tone="muted">No cross-chain swap aggregation or exchange-provider comparison is active. Quotes are only available through configured providers.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Session devices" subtitle="The API process can show/revoke active sessions. Remote-device sync is metadata export/import only." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.sm}>
              {(devices.data?.devices ?? []).map((item: any) => <Row key={item.id} justify="space-between" align="center"><View style={{ flex: 1, gap: 2 }}><Text variant="label">{item.name}</Text><Text variant="caption" tone="muted">Last seen {new Date(item.last_seen).toLocaleString()}</Text></View><Button size="sm" variant="tertiary" label="Revoke" onPress={() => Alert.alert('Revoke session?', 'This may require that device to unlock again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: () => api.featureSuite.revokeDevice(item.id).then(() => invalidate('feature-devices')).catch((e) => Alert.alert('Could not revoke', errorText(e))) }])} /></Row>)}
              {!(devices.data?.devices ?? []).length ? <EmptyState title="No active sessions" hint="Unlock the vault to view this process's sessions." /> : null}
              <Text variant="caption" tone="muted">Remote device revocation and continuous multi-device server sync are not enabled; current session storage is process-local.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Portfolio analytics" subtitle="Values are based on the latest locally stored balances and price sync." />
          <Card style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.sm}>
              <Row justify="space-between"><Text variant="caption" tone="muted">Valued portfolio</Text><Text variant="monoSmall">${Number(analytics.data?.total_value_usd ?? 0).toLocaleString()}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Valued holdings</Text><Text variant="monoSmall">{analytics.data?.valued_holding_count ?? 0}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Unvalued holdings</Text><Text variant="monoSmall">{analytics.data?.unvalued_holding_count ?? 0}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Realized P&L (FIFO ledger)</Text><Text variant="monoSmall">${Number(analytics.data?.realized_gain_loss_usd ?? 0).toLocaleString()}</Text></Row>
              <Row justify="space-between"><Text variant="caption" tone="muted">Unrealized P&L (FIFO ledger)</Text><Text variant="monoSmall">${Number(analytics.data?.unrealized_gain_loss_usd ?? 0).toLocaleString()}</Text></Row>
              {(analytics.data?.allocation ?? []).slice(0, 8).map((item: any) => <Row key={item.asset} justify="space-between"><Text variant="caption">{item.asset}</Text><Text variant="monoSmall">{Number(item.percent).toFixed(2)}%</Text></Row>)}
              <Text variant="caption" tone="muted">Reconciliation: {analytics.data?.reconciliation ?? 'NOT RUN'}. Historical performance is available from the portfolio history view.</Text>
            </Stack>
          </Card>
        </View>

        <View>
          <SectionHeader title="Wallet relationship graph" subtitle="Derived from transaction activity indexed by the existing chain adapter." />
          <Card style={{ marginTop: spacing.md }}>
            <Row justify="space-between"><Text variant="caption" tone="muted">Nodes</Text><Text variant="monoSmall">{graph.data?.nodes?.length ?? 0}</Text></Row>
            <Row justify="space-between"><Text variant="caption" tone="muted">Transfer relationships</Text><Text variant="monoSmall">{graph.data?.edges?.length ?? 0}</Text></Row>
            <Text variant="caption" tone="muted">{graph.data?.coverage ?? 'No graph data available.'}</Text>
          </Card>
        </View>

        <View>
          <SectionHeader title="Network fee quotes" subtitle="Only provider-supplied fresh estimates are shown; unsupported networks are never assigned guessed fees." />
          <Card style={{ marginTop: spacing.md }}>
            <Text variant="label">{fees.data?.status ?? 'Checking fee quotes…'}</Text>
            {(fees.data?.quotes ?? []).slice(0, 6).map((item: any) => <Row key={item.id} justify="space-between"><Text variant="caption">{item.network} · {item.target}</Text><Text variant="monoSmall">{item.fee} {item.unit}</Text></Row>)}
            <Text variant="caption" tone="muted">{fees.data?.no_fallback_estimates_invented ? 'No synthetic estimates are generated.' : ''}</Text>
          </Card>
        </View>
      </Stack>
    </PageContainer>
  );
}