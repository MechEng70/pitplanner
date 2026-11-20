// tools/release.sh --dry-run prints the release steps without running them (T-007).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { appConfigProblems } from './release-app-config.mjs';

const run = (...args) => spawnSync('tools/release.sh', ['--dry-run', ...args], { encoding: 'utf8' });
/** The release steps of a dry run, as printed: the same words the script hands to `env`. */
const stepsOf = r =>
  r.stdout
    .split('\n')
    .filter(l => l.startsWith('+ '))
    .map(l => l.slice(2));

// The emulator is stopped first: it crashed during a release build at 23 of 30 GB in use (T-007).
test('an internal prerelease: emulator stopped, check, production prebuild with the version, signed build, verify, restore dev', () => {
  const r = run('--version', '9.8.7-alpha.1');
  assert.equal(r.status, 0, r.stderr);
  const steps = stepsOf(r);
  // The restore step's text is part of the production prebuild line too, so it is the last match.
  const at = s =>
    s.startsWith('npx expo prebuild') ? steps.findLastIndex(x => x === s) : steps.findIndex(x => x.includes(s));
  const order = [
    'tools/device/avd.sh stop',
    'npm run check',
    'APP_VARIANT=production APP_VERSION=9.8.7-alpha.1 npx expo prebuild --platform android --clean',
    'APP_VARIANT=production APP_VERSION=9.8.7-alpha.1 MALLOC_ARENA_MAX=2 ./gradlew -q assembleRelease',
    'apksigner verify --print-certs',
    'unzip -p android/app/build/outputs/apk/release/app-release.apk assets/app.config | node tools/release-app-config.mjs 9.8.7-alpha.1 90807001 io.github.mecheng70.pitplanner',
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
const appConfig = (over = {}) =>
  JSON.stringify({
    name: 'Pit Planner',
    version: '0.3.0-alpha.1',
    android: { package: 'io.github.mecheng70.pitplanner', versionCode: 300001 },
    extra: { variant: 'production' },
    ...over,
  });
/** A zip standing in for the APK, with `assets/app.config` holding `config` (left out when null). */
function apkWith(config) {
  const dir = mkdtempSync(join(tmpdir(), 'apk-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'index.android.bundle'), 'bundle');
  if (config !== null) writeFileSync(join(dir, 'assets', 'app.config'), config);
  const z = spawnSync('zip', ['-qr', 'app.apk', 'assets'], { cwd: dir, encoding: 'utf8' });
  assert.equal(z.status, 0, z.stderr);
  return join(dir, 'app.apk');
}
const verify = (bt, apk = apkWith(appConfig())) =>
  spawnSync('tools/release.sh', ['--verify', apk, '--version', '0.3.0-alpha.1'], {
    encoding: 'utf8',
    env: { ...process.env, RELEASE_BUILD_TOOLS: bt },
  });
const GOOD = 'b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29';
const BADGING = "package: name='io.github.mecheng70.pitplanner' versionCode='300001' versionName='0.3.0-alpha.1' x";

test('--verify passes a right APK even when the badging dump is long (no SIGPIPE)', () => {
  const r = verify(stubTools(GOOD, BADGING));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /cert ok/);
  assert.match(r.stdout, /app config ok: version 0.3.0-alpha.1, versionCode 300001/);
});

// Regression (2026-11-17, the first release run from a terminal, 0.3.0-beta.2): on a terminal `node --test`
// sets FORCE_COLOR for its test files, and console.log colours a number, so the versionCode came back wrapped
// in colour codes. The gate failed here in a terminal while passing everywhere else, and a release run with
// FORCE_COLOR set would have refused its own APK after the whole build.
test('regression: with colour forced (the gate run in a terminal) the versionCode is plain digits', () => {
  const env = { ...process.env, FORCE_COLOR: '1' };
  const dry = spawnSync('tools/release.sh', ['--dry-run', '--version', '9.8.7-alpha.1'], { encoding: 'utf8', env });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /^release 9\.8\.7-alpha\.1, versionCode 90807001, /m);
  const r = spawnSync('tools/release.sh', ['--verify', apkWith(appConfig()), '--version', '0.3.0-alpha.1'], {
    encoding: 'utf8',
    env: { ...env, RELEASE_BUILD_TOOLS: stubTools(GOOD, BADGING) },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /app config ok: version 0.3.0-alpha.1, versionCode 300001/);
});

test('--verify fails on the wrong certificate or version', () => {
  assert.match(verify(stubTools('00'.repeat(32), BADGING)).stderr, /WRONG CERT/);
  assert.match(verify(stubTools(GOOD, BADGING.replace("'300001'", "'300'"))).stderr, /WRONG PACKAGE OR VERSION/);
});

// T-035 (security pass finding 1): expo-constants writes assets/app.config, what Constants.expoConfig reads
// at run time, during the Gradle build, by evaluating app.config.ts again in Gradle's environment.
// 0.3.0-alpha.5 had APP_VARIANT and APP_VERSION on the prebuild only, so its manifest was right while its app
// config said 0.2.0, build 200999, variant development.

test('regression (finding 1): --verify refuses an APK whose embedded app config is the development one', () => {
  const dev = appConfig({
    name: 'Pit Planner dev',
    version: '0.2.0',
    android: { package: 'io.github.mecheng70.pitplanner.debug', versionCode: 200999 },
    extra: { variant: 'development' },
  });
  const r = verify(stubTools(GOOD, BADGING), apkWith(dev));
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /cert ok/); // the manifest was right; only the app config was wrong
  assert.match(r.stderr, /WRONG APP CONFIG .*version is "0.2.0", must be "0.3.0-alpha.1"/);
  assert.match(r.stderr, /extra.variant is "development", must be "production"/);
});

test('--verify refuses an APK without an app config', () => {
  const r = verify(stubTools(GOOD, BADGING), apkWith(null));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /WRONG APP CONFIG: no assets\/app.config/);
});

// T-102 (Google Play): --bundle builds the Android App Bundle Play takes, through the same pipeline.

test('--bundle: the same steps with bundleRelease; the bundle and its mapping file go to release/', () => {
  const r = run('--version', '9.8.7-alpha.1', '--bundle');
  assert.equal(r.status, 0, r.stderr);
  const steps = stepsOf(r);
  const at = s =>
    s.startsWith('npx expo prebuild') ? steps.findLastIndex(x => x === s) : steps.findIndex(x => x.includes(s));
  const aab = 'android/app/build/outputs/bundle/release/app-release.aab';
  const order = [
    'tools/device/avd.sh stop',
    'npm run check',
    'APP_VARIANT=production APP_VERSION=9.8.7-alpha.1 npx expo prebuild --platform android --clean',
    'APP_VARIANT=production APP_VERSION=9.8.7-alpha.1 MALLOC_ARENA_MAX=2 ./gradlew -q bundleRelease',
    `keytool -printcert -jarfile ${aab}`,
    `unzip -p ${aab} base/assets/app.config | node tools/release-app-config.mjs 9.8.7-alpha.1 90807001 io.github.mecheng70.pitplanner`,
    `cp ${aab} release/pitplanner-9.8.7-alpha.1.aab`,
    'cp android/app/build/outputs/mapping/release/mapping.txt release/pitplanner-9.8.7-alpha.1-mapping.txt',
    'cp android/app/build/outputs/logs/manifest-merger-release-report.txt release/pitplanner-9.8.7-alpha.1-manifest-merger-report.txt',
    'npx expo prebuild --platform android --clean --no-install',
  ];
  for (const s of order) assert.ok(at(s) >= 0, `missing step: ${s}\n${steps.join('\n')}`);
  for (let i = 1; i < order.length; i++)
    assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  assert.match(
    r.stdout,
    /^release 9\.8\.7-alpha\.1, versionCode 90807001, .* -> release\/pitplanner-9\.8\.7-alpha\.1\.aab$/m,
  );
  // A bundle run builds no APK and copies none.
  assert.equal(steps.filter(s => s.includes('assembleRelease') || s.includes('.apk')).length, 0, steps.join('\n'));
});

test('without --bundle nothing of the bundle is built or copied (the APK run is unchanged)', () => {
  const steps = stepsOf(run('--version', '9.8.7-alpha.1'));
  assert.equal(steps.filter(s => /bundleRelease|\.aab|mapping|merger/.test(s)).length, 0, steps.join('\n'));
});

const PERMISSIONS = [
  "uses-permission: name='android.permission.INTERNET'",
  "uses-permission: name='android.permission.USE_EXACT_ALARM'",
  "uses-permission: name='android.permission.SCHEDULE_EXACT_ALARM' maxSdkVersion='32'",
  "uses-permission: name='android.permission.USE_FULL_SCREEN_INTENT'",
];
/** Stub aapt2 (badging and permissions of the bundle's manifest), keytool and jarsigner, as JAVA_HOME/bin. */
function stubBundleTools({ digest = GOOD, badging = BADGING, permissions = PERMISSIONS, signed = true } = {}) {
  const bt = mkdtempSync(join(tmpdir(), 'bt-'));
  const java = mkdtempSync(join(tmpdir(), 'java-'));
  mkdirSync(join(java, 'bin'));
  const sh = (file, body) => {
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
    chmodSync(file, 0o755);
  };
  // The manifest must be handed over as an APK made from the bundle's base module.
  const lines = permissions.map(p => `echo "${p}"`).join('; ');
  sh(
    join(bt, 'aapt2'),
    `unzip -l "$3" | grep -q AndroidManifest.xml || { echo "no manifest in $3" >&2; exit 1; }
if [ "$2" = permissions ]; then echo "package: io.github.mecheng70.pitplanner"; ${lines}
else echo "${badging}"; for i in $(seq 20000); do echo "uses-permission: name='x.$i'"; done; fi`,
  );
  const colons = digest.toUpperCase().replace(/(..)(?=.)/g, '$1:');
  sh(join(java, 'bin', 'keytool'), `echo "Signer #1:"; echo "Owner: CN=PitPlanner"; echo "	 SHA256: ${colons}"`);
  sh(join(java, 'bin', 'jarsigner'), signed ? 'echo "jar verified."' : 'echo "jar is unsigned."');
  return { RELEASE_BUILD_TOOLS: bt, JAVA_HOME: java };
}
/** A zip standing in for the bundle: the base module's manifest, resource table and app config. */
function aabWith(config) {
  const dir = mkdtempSync(join(tmpdir(), 'aab-'));
  mkdirSync(join(dir, 'base', 'manifest'), { recursive: true });
  mkdirSync(join(dir, 'base', 'assets'));
  writeFileSync(join(dir, 'base', 'manifest', 'AndroidManifest.xml'), 'manifest');
  writeFileSync(join(dir, 'base', 'resources.pb'), 'resources');
  if (config !== null) writeFileSync(join(dir, 'base', 'assets', 'app.config'), config);
  const z = spawnSync('zip', ['-qr', 'app.aab', 'base'], { cwd: dir, encoding: 'utf8' });
  assert.equal(z.status, 0, z.stderr);
  return join(dir, 'app.aab');
}
const verifyAab = (tools, aab = aabWith(appConfig())) =>
  spawnSync('tools/release.sh', ['--verify', aab, '--version', '0.3.0-alpha.1'], {
    encoding: 'utf8',
    env: { ...process.env, ...tools },
  });

test('--verify on a bundle: signature, certificate, app ID, version, app config, and its permissions listed', () => {
  const r = verifyAab(stubBundleTools());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /cert ok; package: name='io.github.mecheng70.pitplanner' versionCode='300001'/);
  assert.match(r.stdout, /app config ok: version 0.3.0-alpha.1, versionCode 300001/);
  assert.match(r.stdout, /^permission: android\.permission\.SCHEDULE_EXACT_ALARM maxSdkVersion='32'$/m);
  assert.match(r.stdout, /^permission: android\.permission\.USE_FULL_SCREEN_INTENT$/m);
  assert.equal(r.stdout.match(/^permission: /gm).length, PERMISSIONS.length);
});

test('--verify fails on a bundle that is unsigned, has the wrong certificate, version or app config', () => {
  assert.match(verifyAab(stubBundleTools({ signed: false })).stderr, /NOT SIGNED/);
  assert.match(verifyAab(stubBundleTools({ digest: '00'.repeat(32) })).stderr, /WRONG CERT/);
  const badging = BADGING.replace("'300001'", "'300'");
  assert.match(verifyAab(stubBundleTools({ badging })).stderr, /WRONG PACKAGE OR VERSION/);
  const dev = appConfig({ extra: { variant: 'development' } });
  assert.match(verifyAab(stubBundleTools(), aabWith(dev)).stderr, /WRONG APP CONFIG .*must be "production"/);
  assert.match(verifyAab(stubBundleTools(), aabWith(null)).stderr, /WRONG APP CONFIG: no base\/assets\/app.config/);
});

// Regression (2026-11-20): the first bundle, built by hand, asked for REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
// (from modules/pit-alarms), which Google Play allows for a few app types only.
test('regression: --verify refuses a bundle that asks for the battery permission Play restricts', () => {
  const permissions = [
    ...PERMISSIONS,
    "uses-permission: name='android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'",
  ];
  const r = verifyAab(stubBundleTools({ permissions }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /WRONG PERMISSIONS: .*REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/);
});

/** The VAR=value words in front of the Gradle command of a dry run, which runs in android/. */
function gradleEnv(version) {
  const r = run('--version', version);
  assert.equal(r.status, 0, r.stderr);
  const line = stepsOf(r).find(s => s.includes('./gradlew'));
  assert.ok(line, `no Gradle step:\n${r.stdout}`);
  const m = /^\(cd android && (.*)\)$/.exec(line);
  assert.ok(m, `the Gradle step does not run in android/: ${line}`);
  const words = m[1].split(' ');
  return Object.fromEntries(
    words.slice(0, words.indexOf('./gradlew')).map(w => [w.slice(0, w.indexOf('=')), w.slice(w.indexOf('=') + 1)]),
  );
}

test('regression (finding 1): the Gradle build gets the production variant and the version, as the prebuild does', () => {
  const env = gradleEnv('0.3.0-beta.1');
  assert.equal(env.APP_VARIANT, 'production');
  assert.equal(env.APP_VERSION, '0.3.0-beta.1');
});

/** Runs what Gradle's create<Variant>ExpoConfig task runs (expo-constants), in an environment with `extra`. */
function embeddedConfig(extra) {
  const out = mkdtempSync(join(tmpdir(), 'app-config-'));
  const env = { ...process.env };
  delete env.APP_VARIANT;
  delete env.APP_VERSION;
  const script = join('node_modules', 'expo-constants', 'scripts', 'getAppConfig.js');
  const r = spawnSync('node', [script, process.cwd(), out, 'android', 'false', 'production'], {
    encoding: 'utf8',
    env: { ...env, ...extra },
  });
  assert.equal(r.status, 0, r.stderr);
  return readFileSync(join(out, 'app.config'), 'utf8');
}

test('the app config written in the Gradle step environment is the release asked for (0.3.0-beta.1, 300301)', () => {
  const want = { version: '0.3.0-beta.1', versionCode: 300301, appId: 'io.github.mecheng70.pitplanner' };
  assert.deepEqual(appConfigProblems(embeddedConfig(gradleEnv('0.3.0-beta.1')), want), []);
  // Without it (0.3.0-alpha.5's Gradle step) the file is the development config, and verify refuses it.
  const bare = appConfigProblems(embeddedConfig({}), want);
  assert.ok(bare.includes('extra.variant is "development", must be "production"'), bare.join('; '));
});
