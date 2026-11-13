// The test emulator keeps its own display size (Jason, 2026-11-13: making it 24 dp taller to hide its
// gesture bar was not approved). avd.sh may only put the size back, never set one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = readFileSync(new URL('./avd.sh', import.meta.url), 'utf8');
const code = script
  .split('\n')
  .filter(line => !line.trim().startsWith('#'))
  .join('\n');

test('avd.sh never sets a display size; it only resets one left by an earlier version', () => {
  const calls = [...code.matchAll(/\bwm size\b([^\n|;&)]*)/g)].map(m => m[1].trim());
  assert.ok(calls.length > 0, 'expected the reset of an overridden size');
  for (const args of calls) assert.equal(args, 'reset');
});
