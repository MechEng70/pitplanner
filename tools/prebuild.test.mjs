// tools/prebuild-if-stale.sh decides when the generated android/ must be rebuilt. Runs the script with
// --dry-run against a throwaway project tree in the temp dir (never the repo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = new URL('./prebuild-if-stale.sh', import.meta.url).pathname;

function project() {
  const root = mkdtempSync(join(tmpdir(), 'pitplanner-prebuild-'));
  const put = (path, when) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), 'x');
    if (when != null) utimesSync(join(root, path), when, when);
  };
  const old = new Date(Date.now() - 3600_000);
  for (const f of ['app.config.ts', 'src/theme/tokens.ts', 'package.json', 'package-lock.json']) put(f, old);
  put('modules/pit-alarms/android/src/main/A.kt', old);
  put('android/.prebuild-stamp', new Date(Date.now() - 60_000));
  const run = () =>
    spawnSync(SCRIPT, ['--dry-run'], { env: { ...process.env, PREBUILD_ROOT: root }, encoding: 'utf8' }).stdout.trim();
  return { root, put, run, done: () => rmSync(root, { recursive: true, force: true }) };
}

test('up to date when no source is newer than the stamp', () => {
  const p = project();
  try {
    assert.equal(p.run(), 'android/ is up to date');
  } finally {
    p.done();
  }
});

test('regression: Gradle output under modules/*/android/build does not count as a source change', () => {
  const p = project();
  try {
    p.put('modules/pit-alarms/android/build/tmp/kotlin/x.bin');
    p.put('modules/pit-alarms/android/.gradle/state.bin');
    p.put('modules/pit-alarms/android/.cxx/cmake.txt');
    assert.equal(p.run(), 'android/ is up to date');
  } finally {
    p.done();
  }
});

test('a changed module source, config or token file triggers a prebuild', () => {
  for (const changed of ['modules/pit-alarms/android/src/main/A.kt', 'app.config.ts', 'src/theme/tokens.ts']) {
    const p = project();
    try {
      p.put(changed);
      assert.equal(p.run(), `prebuild: ${changed} changed`);
    } finally {
      p.done();
    }
  }
});

test('a missing stamp triggers a prebuild', () => {
  const p = project();
  try {
    rmSync(join(p.root, 'android'), { recursive: true });
    assert.equal(p.run(), 'prebuild: android/ missing or never stamped');
  } finally {
    p.done();
  }
});
