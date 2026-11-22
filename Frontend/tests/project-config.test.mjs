import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const advanced = readFileSync(new URL('../app/(app)/s/advanced.tsx', import.meta.url), 'utf8');

test('frontend project exposes validation commands', () => {
  assert.equal(typeof packageJson.scripts.typecheck, 'string');
  assert.equal(typeof packageJson.scripts.lint, 'string');
  assert.equal(typeof packageJson.scripts.test, 'string');
});

test('Expo SDK 55 config does not use removed fields', () => {
  assert.equal('newArchEnabled' in appJson.expo, false);
  assert.equal('edgeToEdgeEnabled' in (appJson.expo.android ?? {}), false);
});

test('required native peer is declared directly', () => {
  assert.equal(typeof packageJson.dependencies['react-native-svg'], 'string');
  assert.equal(typeof packageJson.dependencies['expo-font'], 'string');
});

test('capability register includes execution and backup surfaces with conservative availability labels', () => {
  assert.match(advanced, /executionRecords:/);
  assert.match(advanced, /backupRestore:/);
  assert.match(advanced, /globally disabled by default/);
  assert.match(advanced, /no on-chain multisig program integration/);
});