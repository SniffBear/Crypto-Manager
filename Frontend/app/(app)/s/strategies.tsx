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
import {
  errorMessage,
  isRetryable,
  useCreateStrategy,
  useRunStrategy,
  useStrategies,
  useStrategyRuns,
} from '@/hooks/useApi';
import type { Strategy, StrategyRun } from '@/api/types';

export default function StrategiesScreen() {
  const strategies = useStrategies();
  const create = useCreateStrategy();
  const run = useRunStrategy();
  const { open } = useSheet();
  const [selected, setSelected] = useState<Strategy | null>(null);
  const runs = useStrategyRuns(selected?.id ?? null);

  usePageMeta({
    title: 'Strategies',
    subtitle: 'Scheduled rule evaluation and paper-first actions',
    breadcrumbs: [{ label: 'Strategies' }],
  });

  const columns: Column<Strategy>[] = [
    {
      key: 'name',
      header: 'Strategy',
      width: 220,
      render: (row) => (
        <View>
          <Text variant="label">{row.name}</Text>
          <Text variant="monoSmall" tone="muted">{row.id}</Text>
        </View>
      ),
    },
    {
      key: 'state',
      header: 'State',
      width: 130,
      render: (row) => <StatusBadge status={row.enabled ? 'enabled' : 'disabled'} size="sm" />,
    },
    {
      key: 'schedule',
      header: 'Schedule',
      width: 130,
      render: (row) => <Text variant="monoSmall">{row.interval_seconds ?? 60}s</Text>,
    },
    {
      key: 'last',
      header: 'Last run',
      width: 180,
      render: (row) => <Text variant="monoSmall" tone="muted">{row.last_run_status ?? 'NEVER'}</Text>,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 260,
      render: (row) => (
        <Row gap={spacing.sm} wrap>
          <Button label="Select" variant="tertiary" size="sm" onPress={() => setSelected(row)} />
          <Button label="Run now" variant="secondary" size="sm" loading={run.isPending} onPress={() => run.mutate(row.id)} />
        </Row>
      ),
    },
  ];

  const openCreate = () => {
    open({
      title: 'New strategy',
      subtitle: 'Define a schedule and JSON rule/action payload',
      render: (close) => <CreateStrategyForm onClose={close} />,
    });
  };

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Strategies"
          subtitle="Enabled strategies are evaluated by the backend scheduler. Transaction actions remain gated behind the normal execution pipeline."
          actions={<Button label="New strategy" variant="primary" size="sm" onPress={openCreate} />}
        />

        <NoticeBanner
          tone="warning"
          title="Strategy automation is not an execution bypass"
          message="Alert and sync actions can run automatically. Transaction actions are recorded as gated unless they pass the normal execution controls."
        />

        {(create.isError || run.isError) ? (
          <ErrorState
            title="Strategy operation failed"
            message={errorMessage(create.error ?? run.error)}
            retryable={isRetryable(create.error ?? run.error)}
          />
        ) : null}

        <DataTable
          columns={columns}
          data={strategies.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={strategies.isLoading}
          error={strategies.isError ? errorMessage(strategies.error) : null}
          onRetry={() => void strategies.refetch()}
          emptyTitle="No strategies"
          emptyHint="Create a strategy to start scheduled evaluation."
          onRefresh={() => void strategies.refetch()}
          refreshing={strategies.isRefetching}
          caption="Strategies"
        />

        {selected ? (
          <View>
            <SectionHeader title={`Run history · ${selected.name}`} subtitle="Persistent backend run records" />
            <Card variant="elevated" style={{ marginTop: spacing.md }}>
              <Stack gap={spacing.md}>
                {runs.isError ? (
                  <Text variant="caption" tone="danger">{errorMessage(runs.error)}</Text>
                ) : (runs.data ?? []).length === 0 ? (
                  <Text variant="body" tone="muted">No runs recorded yet.</Text>
                ) : (
                  (runs.data ?? []).map((item: StrategyRun) => (
                    <Row key={item.id} justify="space-between" gap={spacing.md}>
                      <Text variant="monoSmall">{item.status}</Text>
                      <Text variant="caption" tone="muted">{item.mode} · {item.finished_at}</Text>
                    </Row>
                  ))
                )}
              </Stack>
            </Card>
          </View>
        ) : null}
      </Stack>
    </PageContainer>
  );
}

function CreateStrategyForm({ onClose }: { onClose: () => void }) {
  const create = useCreateStrategy();
  const [name, setName] = useState('');
  const [interval, setInterval] = useState('60');
  const [rulesJson, setRulesJson] = useState('[{"source":"portfolio","field":"total_value_usd","operator":"gt","threshold":0}]');
  const [actionsJson, setActionsJson] = useState('[{"type":"alert","level":"info","message":"Strategy matched."}]');

  const submit = () => {
    try {
      const rules = JSON.parse(rulesJson);
      const actions = JSON.parse(actionsJson);
      create.mutate(
        {
          name: name.trim(),
          enabled: true,
          interval_seconds: Number(interval),
          rules,
          actions,
        },
        { onSuccess: onClose },
      );
    } catch {
      // The form keeps JSON explicit; backend schema validation also guards the request.
    }
  };

  return (
    <Stack gap={spacing.lg}>
      <Input label="Name" value={name} onChangeText={setName} placeholder="Daily portfolio monitor" />
      <Input label="Interval seconds" value={interval} onChangeText={setInterval} keyboardType="number-pad" />
      <Input label="Rules JSON" value={rulesJson} onChangeText={setRulesJson} multiline />
      <Input label="Actions JSON" value={actionsJson} onChangeText={setActionsJson} multiline />
      <Row gap={spacing.md}>
        <Button label="Create" variant="primary" loading={create.isPending} disabled={!name.trim()} onPress={submit} />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </Row>
    </Stack>
  );
}