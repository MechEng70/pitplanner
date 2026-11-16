// tools/device/db.sh restore: the old data folders are removed inside the app's own folder before the
// backup is unpacked. Regression (2026-11-16, Jason's phone): the delete was passed to `adb shell` as
// separate words, so the device's shell ran `rm -rf` after the `&&` itself, outside the app's folder; it
// removed nothing and a database made after the backup survived the restore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DB = new URL('./db.sh', import.meta.url).pathname;
const PKG = 'io.github.mecheng70.pitplanner.debug';

/** Run `db.sh restore` on a small backup with a fake adb that writes down each call, one argument per line. */
function restore() {
  const dir = mkdtempSync(join(tmpdir(), 'pitplanner-restore-'));
  const calls = join(dir, 'calls');
  writeFileSync(
    join(dir, 'adb'),
    `#!/bin/bash\n{ echo "--call"; printf '%s\\n' "$@"; } >>"${calls}"\ncase " $* " in *" exec-in "*) cat >/dev/null ;; esac\n`,
    { mode: 0o755 },
  );
  mkdirSync(join(dir, 'src', 'files'), { recursive: true });
  mkdirSync(join(dir, 'src', 'shared_prefs'));
  writeFileSync(join(dir, 'src', 'files', 'a'), 'a');
  const tar = join(dir, 'data.tar');
  spawnSync('tar', ['-cf', tar, '-C', join(dir, 'src'), 'files', 'shared_prefs']);
  const r = spawnSync('bash', [DB, 'restore', tar], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      HOME: process.env.HOME,
      ANDROID_SERIAL: 'emulator-5554',
      DEVICE_OUT: dir,
    },
    encoding: 'utf8',
  });
  const text = readFileSync(calls, 'utf8');
  rmSync(dir, { recursive: true, force: true }); // only the temp dir this test made
  return {
    r,
    calls: text
      .split('--call\n')
      .filter(Boolean)
      .map(c => c.trimEnd().split('\n')),
  };
}

test('restore removes the old folders in one command that runs inside the app folder', () => {
  const { r, calls } = restore();
  assert.equal(r.status, 0, r.stderr);
  const rm = calls.filter(c => c.some(a => a.includes('rm -rf')));
  assert.equal(rm.length, 1);
  // adb joins its words with spaces and the device's shell parses the result: the whole of
  // `cd <folder> && rm -rf <dirs>` has to reach run-as's sh as one quoted word.
  const sent = rm[0].slice(rm[0].indexOf('shell') + 1).join(' ');
  assert.equal(sent, `run-as ${PKG} sh -c 'cd /data/data/${PKG} && rm -rf files shared_prefs'`);
});

test('restore unpacks the backup after the delete', () => {
  const { calls } = restore();
  const order = calls
    .map(c => (c.some(a => a.includes('rm -rf')) ? 'rm' : c.includes('exec-in') ? 'untar' : ''))
    .filter(Boolean);
  assert.deepEqual(order, ['rm', 'untar']);
});
