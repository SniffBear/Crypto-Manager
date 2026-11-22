import { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta, useSheet } from '@/components/chrome/shell-context';
import { StatusBadge } from '@/components/StatusBadge';
import { NoticeBanner, ErrorState } from '@/components/feedback/states';
import { errorMessage, isRetryable, useApproveMultisigProposal, useCreateMultisig, useMultisigProposals, useMultisigWallets } from '@/hooks/useApi';

export default function MultisigScreen() {
  const wallets = useMultisigWallets();
  const proposals = useMultisigProposals();
  const create = useCreateMultisig();
  const approve = useApproveMultisigProposal();
  const { open } = useSheet();

  usePageMeta({
    title: 'Multisig',
    subtitle: 'Threshold proposal lifecycle with verified member approvals',
    breadcrumbs: [{ label: 'Menu' }, { label: 'Multisig' }],
  });

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Multisig"
          subtitle="Configure members and thresholds, then collect cryptographic approvals before a proposal becomes READY."
          actions={<Button label="New multisig" variant="primary" size="sm" onPress={() => open({ title: 'Create multisig', render: (close) => <CreateForm close={close} /> })} />}
        />

        <NoticeBanner
          tone="warning"
          title="Approval is not broadcast"
          message="A proposal reaching threshold only marks it READY. Final transaction assembly and execution remain inside the normal signer/execution pipeline."
        />

        {wallets.isError || proposals.isError ? (
          <ErrorState
            title="Multisig unavailable"
            message={errorMessage(wallets.error ?? proposals.error)}
            retryable={isRetryable(wallets.error ?? proposals.error)}
          />
        ) : null}

        <SectionHeader title="Configured multisig wallets" />
        <Stack gap={spacing.md}>
          {(wallets.data ?? []).length === 0 ? (
            <Card variant="flat"><Text variant="body" tone="muted">No multisig configurations yet.</Text></Card>
          ) : (
            (wallets.data ?? []).map((item: any) => (
              <Card key={item.id} variant="elevated">
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <View style={{ flex: 1 }}>
                    <Text variant="h3">{item.name}</Text>
                    <Text variant="monoSmall" tone="muted">
                      {item.threshold}-of-{item.members?.length ?? 0} · {item.id}
                    </Text>
                  </View>
                  <StatusBadge status="configured" size="sm" />
                </Row>
              </Card>
            ))
          )}
        </Stack>

        <SectionHeader title="Proposals" />
        <Stack gap={spacing.md}>
          {(proposals.data ?? []).length === 0 ? (
            <Card variant="flat"><Text variant="body" tone="muted">No multisig proposals yet.</Text></Card>
          ) : (
            (proposals.data ?? []).map((item: any) => (
              <Card key={item.id} variant="elevated">
                <Stack gap={spacing.sm}>
                  <Row justify="space-between" align="center">
                    <Text variant="h3">{item.status}</Text>
                    <StatusBadge status={item.status.toLowerCase()} size="sm" />
                  </Row>
                  <Text variant="monoSmall" tone="muted">{item.id}</Text>
                  <Text variant="caption" tone="secondary">
                    {item.approvals?.length ?? 0} approvals · digest {item.digest}
                  </Text>
                  {item.status !== 'READY' ? (
                    <Button
                      label="Add approval"
                      variant="secondary"
                      size="sm"
                      onPress={() =>
                        open({
                          title: 'Approve proposal',
                          subtitle: 'Provide the member public key and the base58 Ed25519 signature over the proposal digest.',
                          render: (close) => <ApproveForm proposalId={item.id} close={close} approve={approve} />,
                        })
                      }
                    />
                  ) : null}
                </Stack>
              </Card>
            ))
          )}
        </Stack>
      </Stack>
    </PageContainer>
  );
}

function CreateForm({ close }: { close: () => void }) {
  const create = useCreateMultisig();
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [threshold, setThreshold] = useState('2');

  return (
    <Stack gap={spacing.lg}>
      <Input label="Name" value={name} onChangeText={setName} placeholder="Treasury 2-of-3" />
      <Input
        label="Member public keys"
        value={members}
        onChangeText={setMembers}
        placeholder="Base58 address, one per line"
        multiline
      />
      <Input label="Threshold" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" />
      <Row gap={spacing.md}>
        <Button
          label="Create"
          variant="primary"
          loading={create.isPending}
          disabled={!name.trim() || !members.trim()}
          onPress={() => {
            const list = members.split(/\s+/).map((item) => item.trim()).filter(Boolean);
            create.mutate(
              { name: name.trim(), members: list, threshold: Number(threshold) },
              { onSuccess: close },
            );
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={close} />
      </Row>
      {create.isError ? <Text variant="caption" tone="danger">{errorMessage(create.error)}</Text> : null}
    </Stack>
  );
}


function ApproveForm({
  proposalId,
  close,
  approve,
}: {
  proposalId: string;
  close: () => void;
  approve: ReturnType<typeof useApproveMultisigProposal>;
}) {
  const [member, setMember] = useState('');
  const [signature, setSignature] = useState('');

  return (
    <Stack gap={spacing.lg}>
      <Input label="Member public key" value={member} onChangeText={setMember} autoCapitalize="none" autoCorrect={false} />
      <Input label="Base58 signature" value={signature} onChangeText={setSignature} autoCapitalize="none" autoCorrect={false} multiline />
      <NoticeBanner
        tone="info"
        title="External approval"
        message="The backend verifies the signature against the canonical proposal digest; it does not accept a member name as proof."
      />
      {approve.isError ? <Text variant="caption" tone="danger">{errorMessage(approve.error)}</Text> : null}
      <Row gap={spacing.md}>
        <Button
          label="Submit approval"
          variant="primary"
          loading={approve.isPending}
          disabled={!member.trim() || !signature.trim()}
          onPress={() => approve.mutate({ id: proposalId, member: member.trim(), signature_b58: signature.trim() }, { onSuccess: close })}
        />
        <Button label="Cancel" variant="secondary" onPress={close} />
      </Row>
    </Stack>
  );
}