/**
 * ALERT CENTER — what needs review.
 *
 * Alerts arrive from the backend with a level, a kind and an optional wallet
 * attribution. Reading is cheap; acknowledging is the only mutation the
 * backend exposes (`POST /alerts/{id}/read`), so this screen offers exactly
 * that and nothing more.
 *
 * The filters are client-side for the same reason as everywhere else:
 * `GET /alerts` accepts only `unread_only` (DESIGN.md §1, §29).
 *
 * Data: GET /alerts, POST /alerts/{id}/read
 */

import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { FilterBar, ListRow, MetricCard, type FilterGroup } from '@/components/data';
import { StatusBadge } from '@/components/StatusBadge';
import { ALERT_TONE } from '@/design/status';
import { WalletAvatar } from '@/components/utility';
import {
  EmptyState,
  ErrorState,
  NoticeBanner,
  SkeletonList,
} from '@/components/feedback/states';
import {
  errorMessage,
  isRetryable,
  useAlerts,
  useMarkAlertRead,
  useWallets,
  type Alert,
} from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatRelative, titleCase } from '@/utils/format';

const ALL = 'all';

type ReadFilter = 'all' | 'unread' | 'read';
type ScopeFilter = 'all' | 'attributed';

export default function AlertsScreen() {
  const router = useRouter();
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [level, setLevel] = useState(ALL);
  const [scope, setScope] = useState<ScopeFilter>('all');

  const alerts = useAlerts(false);
  const wallets = useWallets();
  const markRead = useMarkAlertRead();

  usePageMeta({
    title: 'Alerts',
    subtitle: 'Signals reported by the backend',
    showWalletSelector: true,
    breadcrumbs: [{ label: 'Alerts' }],
  });

  const all = alerts.data ?? [];

  const walletById = useMemo(() => {
    const map = new Map<string, string>();
    for (const wallet of wallets.data ?? []) map.set(wallet.id, wallet.label);
    return map;
  }, [wallets.data]);

  const levels = useMemo(() => {
    const set = new Set(all.map((alert) => alert.level));
    return [...set].sort();
  }, [all]);

  const rows = useMemo(() => {
    let list = all;
    if (readFilter === 'unread') list = list.filter((a) => !a.read);
    if (readFilter === 'read') list = list.filter((a) => a.read);
    if (level !== ALL) list = list.filter((a) => a.level === level);
    if (scope === 'attributed') list = list.filter((a) => a.wallet_id !== null);
    return list;
  }, [all, readFilter, level, scope]);

  const unread = all.filter((a) => !a.read);
  const critical = unread.filter((a) => a.level === 'critical');
  const attributed = all.filter((a) => a.wallet_id !== null);

  const filterGroups: FilterGroup[] = [
    {
      key: 'read',
      label: 'State',
      value: readFilter,
      onChange: (key) => setReadFilter(key as ReadFilter),
      options: [
        { key: 'all', label: 'All', count: all.length },
        { key: 'unread', label: 'Unread', count: unread.length },
        { key: 'read', label: 'Read', count: all.length - unread.length },
      ],
    },
    {
      key: 'level',
      label: 'Level',
      value: level,
      onChange: setLevel,
      options: [
        { key: ALL, label: 'All', count: all.length },
        ...levels.map((value) => ({
          key: value,
          label: titleCase(value),
          count: all.filter((a) => a.level === value).length,
        })),
      ],
    },
    {
      key: 'scope',
      label: 'Attribution',
      value: scope,
      onChange: (key) => setScope(key as ScopeFilter),
      options: [
        { key: 'all', label: 'Any', count: all.length },
        { key: 'attributed', label: 'Wallet only', count: attributed.length },
      ],
    },
  ];

  const activeFilters =
    (readFilter === 'all' ? 0 : 1) + (level === ALL ? 0 : 1) + (scope === 'all' ? 0 : 1);

  const clearFilters = () => {
    setReadFilter('all');
    setLevel(ALL);
    setScope('all');
  };

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Alerts"
          subtitle="Every signal the backend has reported."
          badges={
            critical.length > 0 ? (
              <StatusBadge
                status="critical"
                label={`${critical.length} CRITICAL UNREAD`}
              />
            ) : unread.length > 0 ? (
              <StatusBadge status="warning" label={`${unread.length} UNREAD`} />
            ) : (
              <StatusBadge status="ok" label="ALL READ" />
            )
          }
        />

        <MetricCard
          label="Unread"
          value={String(unread.length)}
          sublabel={
            critical.length > 0
              ? `${critical.length} critical · ${unread.length - critical.length} other`
              : `${all.length} alert${all.length === 1 ? '' : 's'} in total`
          }
          tone={critical.length > 0 ? 'danger' : unread.length > 0 ? 'warning' : 'success'}
          testID="alerts-unread"
        />

        {alerts.isError ? (
          <ErrorState
            title="Alerts unavailable"
            message={errorMessage(alerts.error)}
            hasStaleData={all.length > 0}
            retryable={isRetryable(alerts.error)}
            onRetry={() => void alerts.refetch()}
          />
        ) : null}

        {/* ── List ──────────────────────────────────────────────────── */}
        {all.length > 0 ? (
          <Card variant="flat" style={styles.filterBar}>
            <FilterBar groups={filterGroups} activeCount={activeFilters} onClear={clearFilters} />
          </Card>
        ) : null}

        {alerts.isLoading ? (
          <SkeletonList count={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? 'No alerts yet' : 'No alerts match these filters'}
            hint={
              all.length === 0
                ? 'Alerts appear when the backend reports a condition worth reviewing. Nothing has been reported yet.'
                : 'Change the filters above to see the other alerts.'
            }
            actionLabel={activeFilters > 0 ? 'Clear filters' : undefined}
            onAction={activeFilters > 0 ? clearFilters : undefined}
          />
        ) : (
          <Card padded={false}>
            <Stack gap={spacing.sm} style={styles.listPad}>
              {rows.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  walletLabel={
                    alert.wallet_id
                      ? (walletById.get(alert.wallet_id) ?? alert.wallet_id)
                      : null
                  }
                  onMarkRead={() => markRead.mutate(alert.id)}
                  marking={markRead.isPending && markRead.variables === alert.id}
                />
              ))}
            </Stack>
          </Card>
        )}

        {/* ── Related ───────────────────────────────────────────────── */}
        <View>
          <SectionHeader title="Related" subtitle="Where alerts lead" />
          <Card padded={false} style={{ marginTop: spacing.md }}>
            <Stack gap={spacing.sm} style={styles.listPad}>
              <ListRow
                title="Risk monitor"
                subtitle="Asset risk buckets across the vault"
                onPress={() => router.push(routes.risk as never)}
              />
              <ListRow
                title="Security"
                subtitle="Vault encryption and wallet permissions"
                onPress={() => router.push(routes.vaultSecurity as never)}
              />
              <ListRow
                title="Activity"
                subtitle="The records these alerts were raised about"
                onPress={() => router.push(routes.activity as never)}
              />
            </Stack>
          </Card>
        </View>

        <NoticeBanner
          tone="neutral"
          title="Acknowledging is the only action"
          message="The backend exposes no way to dismiss, snooze, mute or resolve an alert — only to mark it read. Alert rules, thresholds and destinations are not implemented, so none of those controls are offered here, and the filters above are applied in this app rather than by the API."
        />
      </Stack>
    </PageContainer>
  );
}

function AlertRow({
  alert,
  walletLabel,
  onMarkRead,
  marking,
}: {
  alert: Alert;
  walletLabel: string | null;
  onMarkRead: () => void;
  marking: boolean;
}) {
  return (
    <ListRow
      title={alert.title}
      subtitle={alert.message}
      meta={`${titleCase(alert.kind)} · ${formatRelative(alert.created_at)}${
        walletLabel ? ` · ${walletLabel}` : ''
      }`}
      leading={<StatusBadge status={alert.level} size="sm" tone={ALERT_TONE[alert.level]} />}
      badges={
        <Row gap={spacing.sm} wrap>
          <StatusBadge status={alert.read ? 'read' : 'unread'} size="sm" />
        </Row>
      }
      trailing={
        alert.read ? null : (
          <Button
            label="Mark read"
            variant="tertiary"
            size="sm"
            loading={marking}
            onPress={onMarkRead}
          />
        )
      }
    />
  );
}

const styles = {
  listPad: { padding: spacing.lg },
  filterBar: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
} as const;