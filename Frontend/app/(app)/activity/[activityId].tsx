/**
 * ACTIVITY DETAIL — one record in full.
 *
 * There is no `GET /activity/{id}` in the backend, so the record is resolved
 * from the same list the timeline uses. The page says so, because "opening a
 * record shows everything the backend has" is a claim this screen cannot make
 * and must not appear to make.
 *
 * Optional fields — `signature`, `counterparty`, `asset_mint`, `amount`,
 * `destination` — are rendered only when the backend supplied them, and
 * reported as unreported when it did not. Nothing is filled in from a
 * plausible default (DESIGN.md §1, §32).
 *
 * Data: GET /activity, /wallets
 */

import { useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Divider, KeyValue, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressDisplay, TokenIcon, WalletAvatar } from '@/components/utility';
import {
  EmptyState,
  ErrorState,
  NoticeBanner,
  SkeletonList,
} from '@/components/feedback/states';
import { errorMessage, useActivity, useWallets } from '@/hooks/useApi';
import { routes } from '@/navigation/config';
import { formatDateTime, formatRelative, shortenMint, titleCase } from '@/utils/format';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ activityId: string | string[] }>();
  const activityId = Array.isArray(params.activityId)
    ? (params.activityId[0] ?? null)
    : (params.activityId ?? null);

  const activity = useActivity(200);
  const wallets = useWallets();

  const record = useMemo(
    () => (activity.data ?? []).find((item) => item.id === activityId) ?? null,
    [activity.data, activityId],
  );

  const wallet = useMemo(
    () => (wallets.data ?? []).find((item) => item.id === record?.wallet_id) ?? null,
    [wallets.data, record?.wallet_id],
  );

  usePageMeta({
    title: 'Activity',
    subtitle: record ? titleCase(record.type) : 'Record detail',
    breadcrumbs: [{ label: 'Activity', href: routes.activity }, { label: 'Record' }],
  });

  if (!activityId) {
    return (
      <PageContainer>
        <EmptyState
          title="No record selected"
          hint="This screen needs a record in its address. Open the activity list to choose one."
          actionLabel="Open activity"
          onAction={() => router.replace(routes.activity as never)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title={record ? titleCase(record.type) : 'Record'}
          subtitle={record ? titleCase(record.status) : 'Loading record…'}
          badges={record ? <StatusBadge status={record.status} /> : null}
          actions={
            <Button
              label="Back"
              variant="tertiary"
              size="sm"
              onPress={() => router.back()}
            />
          }
        />

        {activity.isLoading ? (
          <SkeletonList count={4} />
        ) : activity.isError ? (
          <ErrorState
            title="Activity unavailable"
            message={errorMessage(activity.error)}
            retryable
            onRetry={() => void activity.refetch()}
          />
        ) : !record ? (
          <EmptyState
            title="Record not in the returned page"
            hint="The backend has no single-record endpoint, so this screen can only find a record within the most recent page of GET /activity. It may exist further back."
            actionLabel="Back to activity"
            onAction={() => router.replace(routes.activity as never)}
          />
        ) : (
          <>
            {/* ── Summary ──────────────────────────────────────────── */}
            <Card variant="elevated">
              <Stack gap={spacing.md}>
                <Row justify="space-between" align="center" gap={spacing.lg}>
                  <Text variant="overline" tone="muted">
                    {record.type.replace(/[_-]+/g, ' ')}
                  </Text>
                  <StatusBadge status={record.status} size="sm" />
                </Row>
                <Divider />
                <KeyValue label="Record id" value={record.id} />
                <Divider />
                <KeyValue label="Status" value={titleCase(record.status)} />
                <Divider />
                <KeyValue
                  label="Created"
                  value={`${formatDateTime(record.created_at)} · ${formatRelative(record.created_at)}`}
                />
              </Stack>
            </Card>

            {/* ── Wallet ───────────────────────────────────────────── */}
            <View>
              <SectionHeader
                title="Wallet"
                subtitle="The wallet this record is attributed to"
              />
              <Card style={{ marginTop: spacing.md }}>
                {wallet ? (
                  <Row gap={spacing.lg} align="center">
                    <WalletAvatar address={wallet.address} label={wallet.label} size={36} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text variant="body" numberOfLines={1}>
                        {wallet.label}
                      </Text>
                      <AddressDisplay value={wallet.address} kind="wallet address" size="sm" />
                    </View>
                    <Button
                      label="Open"
                      variant="tertiary"
                      size="sm"
                      onPress={() => router.push(routes.walletDetail(wallet.id) as never)}
                    />
                  </Row>
                ) : record.wallet_id ? (
                  <Stack gap={spacing.sm}>
                    <KeyValue label="Wallet id" value={record.wallet_id} />
                    <Text variant="caption" tone="muted">
                      The wallet list has not loaded, or this record points at a wallet that no
                      longer exists.
                    </Text>
                  </Stack>
                ) : (
                  <Text variant="body" tone="muted">
                    This record is not attributed to any wallet.
                  </Text>
                )}
              </Card>
            </View>

            {/* ── Amount / asset / destination ─────────────────────── */}
            <View>
              <SectionHeader
                title="Transfer"
                subtitle="Present only where the backend reported a value"
              />
              <Card style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.sm}>
                  <KeyValue
                    label="Amount"
                    value={record.amount ?? 'Not reported'}
                  />
                  <Divider />
                  {record.asset_mint ? (
                    <>
                      <Row justify="space-between" align="center" gap={spacing.lg}>
                        <Text variant="label" tone="muted">
                          Asset
                        </Text>
                        <Row gap={spacing.md} align="center">
                          <TokenIcon mint={record.asset_mint} size={24} />
                          <Text variant="monoSmall">{shortenMint(record.asset_mint)}</Text>
                        </Row>
                      </Row>
                      <Divider />
                    </>
                  ) : (
                    <KeyValue label="Asset" value="Not reported" />
                  )}
                  <KeyValue
                    label="Destination"
                    value={
                      record.destination ? (
                        <AddressDisplay
                          value={record.destination}
                          kind="destination"
                          size="sm"
                        />
                      ) : (
                        'Not reported'
                      )
                    }
                  />
                </Stack>
              </Card>
            </View>

            {/* ── On-chain identity ────────────────────────────────── */}
            <View>
              <SectionHeader
                title="On-chain identity"
                subtitle="Signature and counterparty"
              />
              <Card style={{ marginTop: spacing.md }}>
                <Stack gap={spacing.sm}>
                  <KeyValue
                    label="Signature"
                    value={
                      record.signature ? (
                        <AddressDisplay value={record.signature} kind="signature" size="sm" />
                      ) : (
                        'Not reported on this record'
                      )
                    }
                  />
                  <Divider />
                  <KeyValue
                    label="Counterparty"
                    value={
                      record.counterparty ? (
                        <AddressDisplay
                          value={record.counterparty}
                          kind="counterparty"
                          size="sm"
                        />
                      ) : (
                        'Not reported on this record'
                      )
                    }
                  />
                </Stack>
              </Card>
            </View>

            <NoticeBanner
              tone="neutral"
              title="What this page cannot show"
              message="The backend has no per-record endpoint and no signature index, so a record outside the most recent page cannot be opened and a signature cannot be resolved to a transaction. The address book that would label a counterparty is not implemented either — a raw address is shown instead of a saved name."
            />
          </>
        )}
      </Stack>
    </PageContainer>
  );
}