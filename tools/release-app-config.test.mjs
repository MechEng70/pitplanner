// tools/release-app-config.mjs: the embedded app config of a release APK must match the release asked for
// (T-035, security pass finding 1).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { appConfigProblems } from './release-app-config.mjs';

const WANT = { version: '0.3.0-beta.1', versionCode: 300301, appId: 'io.github.mecheng70.pitplanner' };
const config = (over = {}) =>
  JSON.stringify({
    name: 'Pit Planner',
    version: '0.3.0-beta.1',
    android: { package: 'io.github.mecheng70.pitplanner', versionCode: 300301 },
    extra: { variant: 'production' },
    ...over,
  });
// What 0.3.0-alpha.5 carried (the security pass read it from the APK): the development defaults.
const ALPHA5 = JSON.stringify({
  name: 'Pit Planner dev',
  version: '0.2.0',
  android: { package: 'io.github.mecheng70.pitplanner.debug', versionCode: 200999 },
  extra: { variant: 'development' },
});

test('the release asked for: no problems', () => {
  assert.deepEqual(appConfigProblems(config(), WANT), []);
});

test('regression (0.3.0-alpha.5): the development app config in a release APK is refused, saying what is wrong', () => {
  const problems = appConfigProblems(ALPHA5, { ...WANT, version: '0.3.0-alpha.5', versionCode: 300005 });
  assert.deepEqual(problems, [
    'version is "0.2.0", must be "0.3.0-alpha.5"',
    'android.versionCode is 200999, must be 300005',
    'android.package is "io.github.mecheng70.pitplanner.debug", must be "io.github.mecheng70.pitplanner"',
    'extra.variant is "development", must be "production"',
  ]);
});

test('each field on its own: version, versionCode, app ID, variant', () => {
  assert.match(appConfigProblems(config({ version: '0.2.0' }), WANT).join(), /^version is "0.2.0"/);
  const code = config({ android: { package: WANT.appId, versionCode: 300001 } });
  assert.match(appConfigProblems(code, WANT).join(), /^android.versionCode is 300001/);
  assert.match(appConfigProblems(config({ extra: {} }), WANT).join(), /^extra.variant is undefined/);
  assert.match(appConfigProblems(config({ extra: { variant: 'development' } }), WANT).join(), /development/);
  // The versionCode is a number in the file; the text "300301" is not the same thing.
  const text = config({ android: { package: WANT.appId, versionCode: '300301' } });
  assert.equal(appConfigProblems(text, WANT).length, 1);
});

test('a missing or broken file is a problem, not a crash', () => {
  assert.deepEqual(appConfigProblems('', WANT), ['assets/app.config is missing or not JSON']);
  assert.deepEqual(appConfigProblems('{"version":', WANT), ['assets/app.config is missing or not JSON']);
  assert.deepEqual(appConfigProblems('null', WANT), ['assets/app.config is not an object']);
});

test('the command line: exit 0 with an ok line, exit 1 with WRONG APP CONFIG on stderr', () => {
  const run = input =>
    spawnSync('node', ['tools/release-app-config.mjs', WANT.version, String(WANT.versionCode), WANT.appId], {
      input,
      encoding: 'utf8',
    });
  const ok = run(config());
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /app config ok: version 0.3.0-beta.1, versionCode 300301/);
  const bad = run(ALPHA5);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /WRONG APP CONFIG .*version is "0.2.0"/);
  assert.equal(spawnSync('node', ['tools/release-app-config.mjs'], { input: '' }).status, 2);
});
