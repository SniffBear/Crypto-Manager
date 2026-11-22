import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { EmptyState, NoticeBanner } from '@/components/feedback/states';

export default function AddressBookScreen() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('solana');
  const [notes, setNotes] = useState('');
  const [trusted, setTrusted] = useState(false);
  const contacts = useQuery({ queryKey: ['address-book'], queryFn: () => api.addressBook.list() });
  const policy = useQuery({ queryKey: ['recipient-policy'], queryFn: () => api.addressBook.policy() });
  const create = useMutation({ mutationFn: api.addressBook.create, onSuccess: () => { setLabel(''); setAddress(''); setNotes(''); setTrusted(false); void qc.invalidateQueries({ queryKey: ['address-book'] }); } });
  const update = useMutation({ mutationFn: ({ id, trusted: value }: { id: string; trusted: boolean }) => api.addressBook.update(id, { trusted: value }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['address-book'] }) });
  const remove = useMutation({ mutationFn: api.addressBook.remove, onSuccess: () => void qc.invalidateQueries({ queryKey: ['address-book'] }) });
  const togglePolicy = useMutation({ mutationFn: api.addressBook.setPolicy, onSuccess: () => void qc.invalidateQueries({ queryKey: ['recipient-policy'] }) });
  const rows = useMemo(() => contacts.data ?? [], [contacts.data]);

  usePageMeta({ title: 'Address book', subtitle: 'Saved destinations and trusted-recipient controls', breadcrumbs: [{ label: 'Menu' }, { label: 'Addresses' }] });

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader title="Address book" subtitle="Contacts are stored inside your encrypted vault and scoped by network." />
        <NoticeBanner tone="info" title="Network-aware contacts" message="The current wallet and transaction engine is Solana-only. Other network labels can be saved for organization, but this does not enable sending on those chains." />
        <Card>
          <Stack gap={spacing.md}>
            <SectionHeader title="Add recipient" subtitle="Never trust an address solely because it has a familiar label." />
            <Input label="CONTACT NAME" value={label} onChangeText={setLabel} placeholder="e.g. Hardware wallet" />
            <Input label="NETWORK" value={network} onChangeText={setNetwork} autoCapitalize="none" placeholder="solana" />
            <Input label="ADDRESS" value={address} onChangeText={setAddress} autoCapitalize="none" mono placeholder="Destination address" />
            <Input label="NOTES (OPTIONAL)" value={notes} onChangeText={setNotes} placeholder="Purpose or verification notes" />
            <Button label={trusted ? 'Trusted recipient: ON' : 'Mark as trusted recipient'} variant="secondary" onPress={() => setTrusted((v) => !v)} />
            <Button label={create.isPending ? 'Saving…' : 'Save contact'} disabled={!label.trim() || !address.trim() || create.isPending} onPress={() => create.mutate({ label, address, network, notes, trusted }, { onError: (e: any) => Alert.alert('Could not save contact', e?.userMessage ?? e?.message ?? 'Request failed') })} />
          </Stack>
        </Card>
        <Card>
          <Stack gap={spacing.md}>
            <SectionHeader title="Recipient protection" subtitle="Require an extra explicit confirmation before sending to unknown or untrusted destinations." />
            <Row align="center" justify="space-between">
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="label">Confirm new recipients</Text>
                <Text variant="caption" tone="muted">{policy.data?.require_new_recipient_confirmation === false ? 'Disabled' : 'Enabled by default'}</Text>
              </View>
              <Button size="sm" variant="secondary" label={policy.data?.require_new_recipient_confirmation === false ? 'Enable' : 'Disable'} onPress={() => togglePolicy.mutate(policy.data?.require_new_recipient_confirmation === false)} />
            </Row>
          </Stack>
        </Card>
        <View>
          <SectionHeader title={`Saved contacts · ${rows.length}`} />
          <Stack gap={spacing.md} style={{ marginTop: spacing.md }}>
            {rows.length === 0 ? <EmptyState title="No saved contacts" hint="Add a recipient above. New addresses still require confirmation when the policy is enabled." /> : rows.map((item: any) => (
              <Card key={item.id}>
                <Stack gap={spacing.sm}>
                  <Row justify="space-between" align="center">
                    <View style={{ flex: 1, gap: 3 }}><Text variant="h3">{item.label}</Text><Text variant="caption" tone="muted">{item.network} · {item.trusted ? 'Trusted' : 'Not trusted'}</Text></View>
                    <Button size="sm" variant="secondary" label={item.trusted ? 'Untrust' : 'Trust'} onPress={() => update.mutate({ id: item.id, trusted: !item.trusted })} />
                  </Row>
                  <Text variant="mono" numberOfLines={3}>{item.address}</Text>
                  {item.notes ? <Text variant="caption" tone="muted">{item.notes}</Text> : null}
                  <Divider />
                  <Button size="sm" variant="tertiary" label="Delete contact" onPress={() => Alert.alert('Delete contact?', `Remove ${item.label} from your address book?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(item.id) }])} />
                </Stack>
              </Card>
            ))}
          </Stack>
        </View>
      </Stack>
    </PageContainer>
  );
}