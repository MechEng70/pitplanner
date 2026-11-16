import getConfig, { variantOf } from './app.config';

// versionCode itself is tested in plugins/version.test.ts (node:test, used by tools/release.sh too).
const build = (variant?: string, version?: string) => {
  const old = { variant: process.env.APP_VARIANT, version: process.env.APP_VERSION };
  const set = (k: 'APP_VARIANT' | 'APP_VERSION', v: string | undefined) => {
    if (v == null) delete process.env[k];
    else process.env[k] = v;
  };
  set('APP_VARIANT', variant);
  set('APP_VERSION', version);
  try {
    return getConfig({ config: {} } as Parameters<typeof getConfig>[0]);
  } finally {
    set('APP_VARIANT', old.variant);
    set('APP_VERSION', old.version);
  }
};

test('the version comes from package.json; release.sh --version builds an internal prerelease', () => {
  expect(build('production').version).toBe(process.env.npm_package_version ?? require('./package.json').version);
  const alpha = build('production', '0.3.0-alpha.1');
  expect(alpha.version).toBe('0.3.0-alpha.1');
  expect(alpha.android?.versionCode).toBe(300001);
  expect(() => build('production', '0.3')).toThrow();
});

test('release signing is applied at prebuild (plugins/withReleaseSigning)', () => {
  const mods = (build('production') as { mods?: { android?: Record<string, unknown> } }).mods;
  expect(mods?.android?.appBuildGradle).toBeDefined();
});

test('Gradle memory limits are applied at prebuild (plugins/withGradleMemory)', () => {
  const mods = (build() as { mods?: { android?: Record<string, unknown> } }).mods;
  expect(mods?.android?.gradleProperties).toBeDefined();
});

// T-035, finding 2. What the rules hold is tested in plugins/backupRules.test.ts, the manifest in
// tools/manifest.test.mjs.
test('backup stays on, with explicit rules written at prebuild (plugins/withBackupRules)', () => {
  for (const variant of ['development', 'production']) {
    const c = build(variant) as ReturnType<typeof build> & { mods?: { android?: Record<string, unknown> } };
    expect(c.android?.allowBackup).toBe(true);
    expect(c.mods?.android?.manifest).toBeDefined();
    expect(c.mods?.android?.dangerous).toBeDefined();
  }
});

// T-035, finding 6. The manifest result is tested in tools/manifest.test.mjs.
test('unused permissions are blocked: storage in both variants, "Display over other apps" in the release', () => {
  const storage = ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'];
  expect(build('production').android?.blockedPermissions).toEqual([
    'android.permission.SYSTEM_ALERT_WINDOW',
    ...storage,
  ]);
  expect(build().android?.blockedPermissions).toEqual(storage);
});

test('development is the default variant; only "production" builds the release app ID', () => {
  expect(variantOf(undefined)).toBe('development');
  expect(variantOf('preview')).toBe('development');
  expect(variantOf('production')).toBe('production');
});

test('the dev build installs beside the release with its own ID and name', () => {
  const dev = build();
  expect(dev.android?.package).toBe('io.github.mecheng70.pitplanner.debug');
  expect(dev.name).toBe('Pit Planner dev');
  const prod = build('production');
  expect(prod.android?.package).toBe('io.github.mecheng70.pitplanner');
  expect(prod.name).toBe('Pit Planner');
  expect(prod.scheme).toBe('pitplanner');
});
