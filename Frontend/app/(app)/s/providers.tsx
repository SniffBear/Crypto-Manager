import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '@/design/tokens';
import { Text } from '@/components/primitives/Text';
import { Button, Card, Input, Row, Stack } from '@/components/primitives';
import { PageContainer } from '@/components/chrome/PageContainer';
import { PageHeader, SectionHeader } from '@/components/chrome/PageHeader';
import { usePageMeta } from '@/components/chrome/shell-context';
import { StatusBadge } from '@/components/StatusBadge';
import { NoticeBanner, ErrorState } from '@/components/feedback/states';
import { errorMessage, isRetryable, useConfigureProvider, useProviderHealth, useProviders } from '@/hooks/useApi';
import { titleCase } from '@/utils/format';

export default function ProvidersScreen() {
  const providers = useProviders();
  const health = useProviderHealth();
  const configure = useConfigureProvider();
  const [selected, setSelected] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  usePageMeta({
    title: 'Networks & providers',
    subtitle: 'Credentials, connectivity and declared capabilities',
    breadcrumbs: [{ label: 'Networks & providers' }],
  });

  const healthMap = useMemo(
    () => new Map((health.data ?? []).map((item) => [item.provider, item])),
    [health.data],
  );

  const configured = (providers.data ?? []).filter((item) => item.configured);

  const save = () => {
    if (!selected) return;
    configure.mutate(
      { name: selected, api_key: apiKey.trim() || undefined, base_url: baseUrl.trim() || undefined },
      { onSuccess: () => { setApiKey(''); setBaseUrl(''); setSelected(null); } },
    );
  };

  return (
    <PageContainer>
      <Stack gap={spacing.xxl}>
        <PageHeader
          title="Networks & providers"
          subtitle="Configure approved provider credentials and inspect real health responses."
        />
        <NoticeBanner
          tone="warning"
          title="Credentials stay on the backend"
          message="Provider keys are stored in the encrypted vault. They are never returned to the client after configuration."
        />
        <Row gap={spacing.md} wrap>
          <StatusBadge status={configured.length ? 'configured' : 'unconfigured'} label={configured.length ? `${configured.length} CONFIGURED` : 'NONE CONFIGURED'} />
          <StatusBadge status="solana mainnet" size="sm" />
        </Row>

        {providers.isError ? (
          <ErrorState title="Providers unavailable" message={errorMessage(providers.error)} retryable={isRetryable(providers.error)} onRetry={() => void providers.refetch()} />
        ) : null}

        <Stack gap={spacing.md}>
          {(providers.data ?? []).map((provider) => {
            const h = healthMap.get(provider.name);
            const active = selected === provider.name;
            const officialApiUnavailable = provider.capabilities.includes('official_api_unavailable');
            return (
              <Card key={provider.name} variant="elevated">
                <Stack gap={spacing.md}>
                  <Row justify="space-between" align="center" wrap>
                    <View>
                      <Text variant="h3">{titleCase(provider.name)}</Text>
                      <Text variant="monoSmall" tone="muted">{provider.base_url ?? 'Default endpoint'}</Text>
                    </View>
                    <Row gap={spacing.sm} wrap>
                      <StatusBadge status={h?.status ?? (provider.configured ? 'configured' : 'unconfigured')} size="sm" />
                      {h?.latency_ms != null ? <Text variant="monoSmall" tone="muted">{h.latency_ms} ms</Text> : null}
                    </Row>
                  </Row>
                  <Text variant="caption" tone="secondary">{provider.capabilities.length ? provider.capabilities.join(' · ') : 'No declared capabilities'}</Text>
                  {h?.detail ? <Text variant="caption" tone="muted">{h.detail}</Text> : null}
                  <Button
                    label={
                      officialApiUnavailable
                        ? 'No official API'
                        : active
                          ? 'Close configuration'
                          : provider.configured
                            ? 'Update credentials'
                            : 'Configure'
                    }
                    variant="tertiary"
                    size="sm"
                    disabled={officialApiUnavailable}
                    onPress={() => { setSelected(active ? null : provider.name); setApiKey(''); setBaseUrl(provider.base_url ?? ''); }}
                  />
                  {active ? (
                    <Card variant="flat">
                      <Stack gap={spacing.md}>
                        <Input label="API key" value={apiKey} onChangeText={setApiKey} placeholder="Paste provider credential" autoCapitalize="none" autoCorrect={false} secureTextEntry />
                        <Input label="Base URL override" value={baseUrl} onChangeText={setBaseUrl} placeholder={provider.base_url ?? 'https://…'} autoCapitalize="none" autoCorrect={false} />
                        <Row gap={spacing.md} wrap>
                          <Button label="Save" variant="primary" loading={configure.isPending} onPress={save} />
                          <Button label="Cancel" variant="secondary" onPress={() => setSelected(null)} />
                        </Row>
                        {configure.isError ? <Text variant="caption" tone="danger">{errorMessage(configure.error)}</Text> : null}
                      </Stack>
                    </Card>
                  ) : null}
                </Stack>
              </Card>
            );
          })}
        </Stack>

        <SectionHeader title="Health notes" />
        <Card variant="flat">
          <Stack gap={spacing.sm}>
            <Text variant="caption" tone="secondary">A provider is only marked healthy after a provider-specific request succeeds.</Text>
            <Text variant="caption" tone="muted">Some providers require explicit account approval or paid API access. The UI reports those states rather than pretending an unofficial integration exists.</Text>
          </Stack>
        </Card>
      </Stack>
    </PageContainer>
  );
}