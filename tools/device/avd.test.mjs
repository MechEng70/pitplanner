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

// T-037: the alarm test also runs on Android 14 and 15 images. The default stays the API 36 AVD "pitplanner".
test('avd.sh defaults to API 36 and the AVD "pitplanner"; AVD_API picks another image and its own AVD', () => {
  assert.match(code, /API="\$\{AVD_API:-36\}"/);
  assert.match(code, /NAME=pitplanner\n\[ "\$API" = 36 \] \|\| NAME="pitplanner-api\$API"/);
  assert.match(code, /IMAGE="system-images;android-\$API;google_apis;x86_64"/);
});

test('avd.sh start prints only the serial on stdout (run.sh reads it): notices go to stderr', () => {
  const echoes = code.split('\n').filter(l => /^\s*echo /.test(l) && !/>&2/.test(l) && !/^\s*echo no \|/.test(l));
  assert.deepEqual(
    echoes.map(l => l.trim()),
    ['echo "$s"'],
  );
});
