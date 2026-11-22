import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('address book and reconciliation have real screens and API bindings', () => {
  const root = new URL('../', import.meta.url);
  const nav = readFileSync(new URL('src/navigation/config.ts', root), 'utf8');
  const addressBook = readFileSync(new URL('app/(app)/s/address-book.tsx', root), 'utf8');
  const reconciliation = readFileSync(new URL('app/(app)/s/reconciliation.tsx', root), 'utf8');
  const api = readFileSync(new URL('src/api/client.ts', root), 'utf8');
  assert.match(nav, /addressBook: 'live'/);
  assert.match(nav, /portfolioReconciliation: 'live'/);
  assert.match(addressBook, /trusted-recipient/);
  assert.match(reconciliation, /Solana only/);
  assert.match(api, /check-recipient/);
  assert.match(api, /portfolio\/reconciliation\/run/);
});