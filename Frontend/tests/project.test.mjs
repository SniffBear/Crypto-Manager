import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';



test('expanded feature suite exposes security, backup and network-readiness controls', () => {
  const screen = readFileSync('app/(app)/s/feature-suite.tsx', 'utf8');
  const client = readFileSync('src/api/client.ts', 'utf8');
  const capabilityMap = readFileSync('src/navigation/config.ts', 'utf8');
  for (const label of [
    'Security alert center',
    'Backup integrity & recovery',
    'Network support matrix',
    'Exchange & transaction history',
    'Clipboard address verification',
    'Cost basis & tax ledger',
  ]) assert.ok(screen.includes(label), `missing ${label}`);
  for (const endpoint of [
    '/features/security-alerts',
    '/features/recovery-checklist',
    '/features/backups/inventory',
    '/features/network-capabilities',
    '/features/exchange-history',
    '/features/transactions/export.csv',
  ]) assert.ok(client.includes(endpoint), `missing API endpoint ${endpoint}`);
  assert.ok(capabilityMap.includes("securityAlertReview: 'live'"));
  assert.ok(capabilityMap.includes("networkCapabilityMatrix: 'live'"));
  assert.ok(screen.includes('Not integrated'));
  assert.ok(screen.includes('No cross-chain swap aggregation'));
});