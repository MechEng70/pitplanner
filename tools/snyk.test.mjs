// tools/snyk.sh (check step 6) must fail when Snyk skips a project or tests fewer projects than exist.
// Regression: on 2026-11-12 Snyk printed "1/24 potential projects failed to get dependencies" and exited 0, so
// the gate passed with a project unscanned. Runs tools/snyk.sh against a fake snyk and a fake project tree in
// the temp dir: no network, no real scan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('./snyk.sh', import.meta.url).pathname;
const GRADLE_PROJECTS = ['', ':app', ':pit-alarms']; // '' is the root project

/** A fake project (package-lock.json + android/gradlew listing GRADLE_PROJECTS) and a fake snyk. */
/**
 * `first`: what the first call of each kind (`test`, `code`) does instead: `{ test: { rc, log } }`. Every call
 * is counted; the result carries `calls` ({ test, code }).
 */
function setup({ tested, log = '', rc = 0, first = {}, codeRc = 0, codeLog = '' }) {
  const root = mkdtempSync(join(tmpdir(), 'pitplanner-snyk-'));
  writeFileSync(join(root, 'package-lock.json'), '{}');
  mkdirSync(join(root, 'android'));
  const gradlew = join(root, 'android', 'gradlew');
  writeFileSync(
    gradlew,
    [
      '#!/bin/bash',
      'echo "Root project \'Pit Planner dev\'"',
      ...GRADLE_PROJECTS.filter(Boolean).map(p => `echo "+--- Project '${p}'"`),
    ].join('\n') + '\n',
  );
  chmodSync(gradlew, 0o755);
  // tested: the projects the fake snyk reports in its --json-file-output.
  const results = tested.map(t =>
    t === 'npm'
      ? { packageManager: 'npm', projectName: 'pit-planner', displayTargetFile: 'package-lock.json', ok: true }
      : {
          packageManager: 'gradle',
          projectName: t === '' ? 'Pit Planner dev' : `Pit Planner dev/${t.slice(1)}`,
          displayTargetFile: 'android/build.gradle',
          ok: true,
        },
  );
  const fake = join(root, 'fake-snyk');
  writeFileSync(
    fake,
    `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const kind = args[0] === 'code' ? 'code' : 'test';
const countFile = ${JSON.stringify(join(root, 'calls-'))} + kind;
const n = (fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) : 0) + 1;
fs.writeFileSync(countFile, String(n));
const first = ${JSON.stringify(first)}[kind];
if (n === 1 && first) { process.stdout.write(first.log); process.exit(first.rc); }
if (kind === 'code') { process.stdout.write(${JSON.stringify(codeLog)}); process.exit(${codeRc}); }
const out = args.find(a => a.startsWith('--json-file-output='));
if (out) require('fs').writeFileSync(out.split('=')[1], ${JSON.stringify(JSON.stringify(results))});
process.stdout.write(${JSON.stringify(log)});
process.exit(${rc});
`,
  );
  chmodSync(fake, 0o755);
  const r = spawnSync(SCRIPT, [], {
    env: { ...process.env, SNYK_BIN: fake, SNYK_ROOT: root, SNYK_RETRY_WAIT: '0' },
    encoding: 'utf8',
  });
  const count = kind =>
    existsSync(join(root, `calls-${kind}`)) ? Number(readFileSync(join(root, `calls-${kind}`), 'utf8')) : 0;
  r.calls = { test: count('test'), code: count('code') };
  rmSync(root, { recursive: true, force: true }); // only the temp tree this test made
  return r;
}

const ALL = ['npm', ...GRADLE_PROJECTS];

test('passes when every npm and Gradle project is tested and none is skipped', () => {
  const r = setup({ tested: ALL, log: 'Tested 4 projects, no vulnerable paths were found.\n' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('regression: fails when Snyk reports a skipped project but exits 0', () => {
  const r = setup({
    tested: ALL,
    log: 'Tested 4 projects, no vulnerable paths were found.\n✗ 1/5 potential projects failed to get dependencies.\n',
  });
  assert.notEqual(r.status, 0, 'gate passed with a skipped project');
  assert.match(r.stdout + r.stderr, /skipped/i);
});

test('regression: fails when Snyk tests fewer projects than exist (a Gradle subproject missing)', () => {
  const r = setup({ tested: ['npm', '', ':app'], log: 'Tested 3 projects, no vulnerable paths were found.\n' });
  assert.notEqual(r.status, 0, 'gate passed with :pit-alarms untested');
  assert.match(r.stdout + r.stderr, /:pit-alarms/);
});

test('fails when the npm project is missing', () => {
  const r = setup({ tested: GRADLE_PROJECTS, log: '' });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /package-lock\.json/);
});

test('fails when Snyk finds high or critical issues (exit 1)', () => {
  const r = setup({ tested: ALL, log: 'Tested 4 projects, 1 contained vulnerable paths.\n', rc: 1 });
  assert.notEqual(r.status, 0);
});

// Retry (Jason, 2026-11-13): a 504 from Snyk's server failed the gate with nothing wrong in the project.
const GATEWAY =
  ' ERROR   Unspecified Error (SNYK-CLI-0000)\n           Failed to get vulns\nStatus:  504 Gateway Timeout\n';
const OK = 'Tested 4 projects, no vulnerable paths were found.\n';

test('regression: a 504 from Snyk is retried once and the gate passes when the retry does', () => {
  const r = setup({ tested: ALL, log: OK, first: { test: { rc: 2, log: GATEWAY } } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.calls, { test: 2, code: 1 });
  assert.match(r.stdout, /trying once more/);
});

test('a server error that happens twice fails the gate after exactly one retry', () => {
  const r = setup({ tested: ALL, log: GATEWAY, rc: 2, first: { test: { rc: 2, log: GATEWAY } } });
  assert.notEqual(r.status, 0);
  assert.deepEqual(r.calls, { test: 2, code: 0 });
});

test('a network timeout in the code scan is retried once too', () => {
  const r = setup({
    tested: ALL,
    log: OK,
    first: { code: { rc: 2, log: 'request to https://api.snyk.io failed, reason: ETIMEDOUT\n' } },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.calls, { test: 1, code: 2 });
});

test('findings are never retried, even when the output mentions a timeout', () => {
  const log =
    'Tested 4 projects, 1 contained vulnerable paths.\n  ✗ High severity: Denial of Service via connection timeout\n';
  const r = setup({ tested: ALL, log: OK, first: { test: { rc: 1, log } } });
  assert.notEqual(r.status, 0, 'findings were retried and the gate passed');
  assert.deepEqual(r.calls, { test: 1, code: 0 });
  const code = setup({ tested: ALL, log: OK, first: { code: { rc: 1, log: '✗ [High] Hardcoded Secret\n' } } });
  assert.notEqual(code.status, 0);
  assert.deepEqual(code.calls, { test: 1, code: 1 });
});

test('an error that is not a server or network error (not signed in) is not retried', () => {
  const r = setup({
    tested: ALL,
    log: OK,
    first: { test: { rc: 2, log: 'Authentication error (SNYK-0005). Use `snyk auth`.\n' } },
  });
  assert.notEqual(r.status, 0);
  assert.deepEqual(r.calls, { test: 1, code: 0 });
});
