// tools/device/lib.sh: while tools/device/PHONE-BLOCKED exists, no device tool may pick the real phone
// (Jason, 2026-11-13: a real cook was running on it). The emulator stays available.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIB = new URL('./lib.sh', import.meta.url).pathname;

/** Run pick_target with a fake adb (so no real device is asked) and the given environment. */
function pick(env, blocked) {
  const dir = mkdtempSync(join(tmpdir(), 'pitplanner-block-'));
  const adb = join(dir, 'adb');
  writeFileSync(
    adb,
    '#!/bin/bash\nprintf "List of devices attached\\nPHONE123\\tdevice\\nemulator-5554\\tdevice\\n"\n',
    { mode: 0o755 },
  );
  const file = join(dir, 'PHONE-BLOCKED');
  if (blocked) writeFileSync(file, 'a cook is running\n');
  const r = spawnSync('bash', ['-c', `. "${LIB}"; pick_target && echo "picked $ANDROID_SERIAL"`], {
    env: { PATH: `${dir}:${process.env.PATH}`, HOME: process.env.HOME, PHONE_BLOCK_FILE: file, ...env },
    encoding: 'utf8',
  });
  rmSync(dir, { recursive: true, force: true }); // only the temp dir this test made
  return r;
}

test('blocked: asking for the phone is refused and says why', () => {
  const r = pick({ DEVICE_TARGET: 'phone' }, true);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /off limits: a cook is running/);
  assert.doesNotMatch(r.stdout, /picked/);
});

test('blocked: a phone serial given directly is refused too', () => {
  const r = pick({ ANDROID_SERIAL: 'PHONE123' }, true);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /off limits/);
});

test('blocked: the emulator is still picked, by default and by serial', () => {
  assert.match(pick({}, true).stdout, /picked emulator-5554/);
  assert.match(pick({ ANDROID_SERIAL: 'emulator-5554' }, true).stdout, /picked emulator-5554/);
});

test('not blocked: the phone can be picked', () => {
  assert.match(pick({ DEVICE_TARGET: 'phone' }, false).stdout, /picked PHONE123/);
});
