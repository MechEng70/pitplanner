import getConfig, { variantOf, versionCode } from './app.config';

const build = (variant?: string) => {
  const old = process.env.APP_VARIANT;
  if (variant == null) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return getConfig({ config: {} } as Parameters<typeof getConfig>[0]);
  } finally {
    process.env.APP_VARIANT = old;
  }
};

test('versionCode is major*10000 + minor*100 + patch, so 0.3.0 upgrades 0.2.0 (200)', () => {
  expect(versionCode('0.2.0')).toBe(200);
  expect(versionCode('0.3.0')).toBe(300);
  expect(versionCode('1.2.3')).toBe(10203);
  expect(() => versionCode('0.3')).toThrow();
  expect(() => versionCode('0.100.0')).toThrow();
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
