import { useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta, useSheet } from '@/components/chrome/shell-context';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable, type Column } from '@/components/DataTable';
import { NoticeBanner, ErrorState } from '@/components/feedback/states';
import { useConfirmDialog } from '@/components/feedback/confirmation-context';
import {
  errorMessage,
  isRetryable,
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
  useRollbackBackup,
  useVerifyBackup,
} from '@/hooks/useApi';
import { formatBytes } from '@/utils/format';
import type { BackupFile } from '@/api/types';

export default function BackupsScreen() {
  const backups = useBackups();
  const create = useCreateBackup();
  const verify = useVerifyBackup();
  const restore = useRestoreBackup();
  const rollback = useRollbackBackup();
  const remove = useDeleteBackup();
  const { confirm } = useConfirmDialog();
  const { open } = useSheet();
  const [selected, setSelected] = useState<BackupFile | null>(null);
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<string | null>(null);

  usePageMeta({
    title: 'Backup center',
    subtitle: 'Create, verify, restore, rollback and prune encrypted vault copies',
    breadcrumbs: [{ label: 'Backups' }],
  });

  const runCreate = async () => {
    if (!(await confirm({
      title: 'Create encrypted backup?',
      message: 'A copy of the encrypted vault will be written to the backend backup directory.',
      confirmLabel: 'Create backup',
      tone: 'warning',
    }))) return;
    create.mutate();
  };

  const runVerify = (file: BackupFile) => {
    setSelected(file);
    verify.mutate(file.name, {
      onSuccess: (v) => setResult(v.valid ? 'Backup checksum verified.' : (v.detail ?? 'Backup verification failed.')),
    });
  };

  const openRestore = (mode: 'restore' | 'rollback') => {
    if (!selected) return;
    open({
      title: mode === 'restore' ? 'Restore backup' : 'Rollback to backup',
      subtitle: 'Re-authentication is required before the encrypted vault is replaced.',
      render: (close) => (
        <Stack gap={spacing.lg}>
          <Input label="Vault password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
          <NoticeBanner
            tone="warning"
            title="This will lock the current session"
            message="A pre-restore rollback copy is created automatically before replacement. Unlock is required afterward."
          />
          <Row gap={spacing.md} wrap>
            <Button
              label={mode === 'restore' ? 'Restore' : 'Rollback'}
              variant="destructive"
              loading={restore.isPending || rollback.isPending}
              onPress={() => {
                if (mode === 'restore') {
                  restore.mutate({ name: selected.name, password }, { onSuccess: (v) => { setResult(`Restored ${v.name}; unlock required.`); setPassword(''); close(); } });
                } else {
                  rollback.mutate({ name: selected.name, password }, { onSuccess: (v) => { setResult(`Rolled back to ${v.name}; unlock required.`); setPassword(''); close(); } });
                }
              }}
            />
            <Button label="Cancel" variant="secondary" onPress={close} />
          </Row>
        </Stack>
      ),
    });
  };

  const runDelete = async (file: BackupFile) => {
    if (!(await confirm({
      title: `Delete ${file.name}?`,
      message: 'The encrypted backup and its checksum manifest will be deleted from the backend host.',
      confirmLabel: 'Delete backup',
      tone: 'danger',
    }))) return;
    remove.mutate(file.name);
  };

  const columns: Column<BackupFile>[] = [
    {
      key: 'name',
      header: 'Backup',
      width: 300,
      mono: true,
      render: (row) => <Text variant="monoSmall" numberOfLines={1}>{row.name}</Text>,
    },
    {
      key: 'size',
      header: 'Size',
      width: 120,
      align: 'right',
      mono: true,
      render: (row) => <Text variant="monoSmall" align="right">{formatBytes(row.size)}</Text>,
    },
    {
      key: 'checksum',
      header: 'Checksum',
      width: 150,
      render: (row) => <StatusBadge status={row.manifest ? 'verified' : 'unknown'} label={row.manifest ? 'MANIFEST' : 'NO MANIFEST'} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 360,
      render: (row) => (
        <Row gap={spacing.sm} wrap>
          <Button label="Verify" variant="tertiary" size="sm" onPress={() => runVerify(row)} />
          <Button label="Restore" variant="secondary" size="sm" onPress={() => { setSelected(row); openRestore('restore'); }} />
          <Button label="Delete" variant="destructive" size="sm" onPress={() => void runDelete(row)} />
        </Row>
      ),
    },
  ];

  const selectedName = selected?.name ?? 'None';

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Backup center"
          subtitle="Encrypted copies on the backend host"
          actions={<Button label="Create backup" variant="primary" size="sm" loading={create.isPending} onPress={() => void runCreate()} />}
        />

        <NoticeBanner
          tone="info"
          title="Rollback safety"
          message="Every restore creates a fresh pre-restore backup before replacement. Retention is controlled by BACKUP_RETENTION_COUNT."
        />

        {create.isError || verify.isError || restore.isError || rollback.isError || remove.isError ? (
          <ErrorState
            title="Backup operation failed"
            message={errorMessage(create.error ?? verify.error ?? restore.error ?? rollback.error ?? remove.error)}
            retryable={isRetryable(create.error ?? verify.error ?? restore.error ?? rollback.error ?? remove.error)}
          />
        ) : null}

        {result ? <Card variant="flat"><Text variant="caption" tone="secondary">{result}</Text></Card> : null}

        <SectionHeader title="Stored backups" subtitle={`${backups.data?.length ?? 0} encrypted copies · selected: ${selectedName}`} />
        <DataTable
          columns={columns}
          data={backups.data ?? []}
          getRowKey={(row) => row.name}
          isLoading={backups.isLoading}
          error={backups.isError ? errorMessage(backups.error) : null}
          onRetry={() => void backups.refetch()}
          emptyTitle="No backups yet"
          emptyHint="Create the first encrypted backup to establish a recoverable restore point."
          onRefresh={() => void backups.refetch()}
          refreshing={backups.isRefetching}
          caption="Backup inventory"
        />

        {selected ? (
          <Card variant="elevated">
            <Stack gap={spacing.md}>
              <Text variant="overline" tone="muted">Selected backup</Text>
              <Text variant="monoSmall">{selected.name}</Text>
              {selected.manifest ? (
                <Text variant="monoSmall" tone="muted">{selected.manifest.sha256}</Text>
              ) : null}
              <Button label="Rollback selected backup" variant="destructive" onPress={() => openRestore('rollback')} />
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </PageContainer>
  );
}