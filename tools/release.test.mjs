// tools/release.sh --dry-run prints the release steps without running them (T-007).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const run = (...args) => spawnSync('tools/release.sh', ['--dry-run', ...args], { encoding: 'utf8' });

// The emulator is stopped first: it crashed during a release build at 23 of 30 GB in use (T-007).
test('an internal prerelease: emulator stopped, check, production prebuild with the version, signed build, verify, restore dev', () => {
  const r = run('--version', '9.8.7-alpha.1');
  assert.equal(r.status, 0, r.stderr);
  const steps = r.stdout
    .split('\n')
    .filter(l => l.startsWith('+ '))
    .map(l => l.slice(2));
  // The restore step's text is part of the production prebuild line too, so it is the last match.
  const at = s =>
    s.startsWith('npx expo prebuild') ? steps.findLastIndex(x => x === s) : steps.findIndex(x => x.includes(s));
  const order = [
    'tools/device/avd.sh stop',
    'npm run check',
    'APP_VARIANT=production APP_VERSION=9.8.7-alpha.1 npx expo prebuild --platform android --clean',
    './gradlew assembleRelease',
    'apksigner verify --print-certs',
    'cp android/app/build/outputs/apk/release/app-release.apk release/pitplanner-9.8.7-alpha.1.apk',
    'npx expo prebuild --platform android --clean --no-install',
  ];
  for (const s of order) assert.ok(at(s) >= 0, `missing step: ${s}\n${steps.join('\n')}`);
  for (let i = 1; i < order.length; i++)
    assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  assert.match(r.stdout, /versionCode 90807001/);
  assert.match(r.stdout, /cert SHA-256 must be b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29/);
});

test('--version is only for prereleases: a release bumps package.json instead', () => {
  const r = run('--version', '0.3.0');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /prerelease/);
});

test('a bad version is refused before anything runs', () => {
  const r = run('--version', '0.3-alpha.1');
  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.stdout, /^\+ /m);
});

// Regression (T-007 first run): `aapt2 dump badging | head -1` under pipefail died with SIGPIPE (exit 141)
// after a 15-minute build. --verify checks an APK with stub build tools that print a long badging dump.

function stubTools(digest, badging) {
  const bt = mkdtempSync(join(tmpdir(), 'bt-'));
  mkdirSync(bt, { recursive: true });
  const sh = (name, body) => {
    writeFileSync(join(bt, name), `#!/bin/bash\n${body}\n`);
    chmodSync(join(bt, name), 0o755);
  };
  sh('apksigner', `echo "Signer #1 certificate SHA-256 digest: ${digest}"`);
  sh('aapt2', `echo "${badging}"; for i in $(seq 20000); do echo "uses-permission: name='x.$i'"; done`);
  return bt;
}
const verify = bt =>
  spawnSync('tools/release.sh', ['--verify', 'some.apk', '--version', '0.3.0-alpha.1'], {
    encoding: 'utf8',
    env: { ...process.env, RELEASE_BUILD_TOOLS: bt },
  });
const GOOD = 'b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29';
const BADGING = "package: name='io.github.mecheng70.pitplanner' versionCode='300001' versionName='0.3.0-alpha.1' x";

test('--verify passes a right APK even when the badging dump is long (no SIGPIPE)', () => {
  const r = verify(stubTools(GOOD, BADGING));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /cert ok/);
});

test('--verify fails on the wrong certificate or version', () => {
  assert.match(verify(stubTools('00'.repeat(32), BADGING)).stderr, /WRONG CERT/);
  assert.match(verify(stubTools(GOOD, BADGING.replace("'300001'", "'300'"))).stderr, /WRONG PACKAGE OR VERSION/);
});
