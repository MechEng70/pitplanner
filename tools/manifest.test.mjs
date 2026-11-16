// The app's own AndroidManifest.xml as prebuild makes it, read through `expo config --type introspect` (all
// config plugins applied, nothing written to android/). T-035, security pass findings 2 and 6. Library
// manifests are merged later by Gradle: a permission blocked here is written with tools:node="remove", which
// removes it from the merged manifest too.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function mainManifest(variant) {
  const env = { ...process.env, APP_VARIANT: variant };
  delete env.APP_VERSION;
  const r = spawnSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], {
    encoding: 'utf8',
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(r.stdout)._internal?.modResults?.android?.manifest?.manifest;
  assert.ok(m, 'no manifest in the introspected config');
  return m;
}
const manifests = { production: mainManifest('production'), development: mainManifest('development') };
const app = m => m.application[0].$;

test('regression (finding 2): both variants keep backup on, with explicit rules', () => {
  for (const [variant, m] of Object.entries(manifests)) {
    assert.equal(app(m)['android:allowBackup'], 'true', variant);
    assert.equal(app(m)['android:fullBackupContent'], '@xml/pitplanner_backup_rules', variant);
    assert.equal(app(m)['android:dataExtractionRules'], '@xml/pitplanner_data_extraction_rules', variant);
  }
});

test('no debug flags in the app manifest', () => {
  for (const m of Object.values(manifests)) {
    assert.equal(app(m)['android:debuggable'], undefined);
    assert.equal(app(m)['android:usesCleartextTraffic'], undefined);
    assert.equal(app(m)['android:requestLegacyExternalStorage'], undefined);
  }
});
