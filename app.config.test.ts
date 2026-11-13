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
