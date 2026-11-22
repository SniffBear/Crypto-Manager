import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['app', 'src'].filter((path) => {
  try { return statSync(path).isDirectory(); } catch { return false; }
});

const conflicts = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) continue;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^(<<<<<<<|=======|>>>>>>>)( |$)/.test(line)) {
        conflicts.push(`${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

for (const root of roots) walk(root);

if (conflicts.length) {
  console.error('Merge-conflict markers found:');
  for (const item of conflicts) console.error(`  ${item}`);
  process.exit(1);
}

const tsc = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
const result = spawnSync(tsc, ['--noEmit'], { stdio: 'inherit' });
process.exit(result.status ?? 1);