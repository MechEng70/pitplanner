// T-035 (security pass finding 1), the app's side: what a release build knows about itself comes from the
// app config expo-constants embeds during the Gradle build (assets/app.config, Constants.expoConfig).
// tools/release.sh now builds it with APP_VARIANT=production and APP_VERSION (tools/release.test.mjs); here
// the app reads such a config. Gear's version line, the update check and Export my data read the same
// `Constants.expoConfig?.version` as readDeviceFacts.
import getConfig from '../../app.config';
import { versionCode } from '../../plugins/version';
import { availableUpdate, fetchLatest, isPrerelease } from '../lib/update';
import { readDeviceFacts } from './device';

const mockConstants: { expoConfig: unknown } = { expoConfig: null };
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConstants.expoConfig;
    },
  },
}));

/** app.config.ts evaluated as Gradle's expo-constants task does it, in the environment `env`. */
function embedded(env: { APP_VARIANT?: string; APP_VERSION?: string }) {
  const old = { APP_VARIANT: process.env.APP_VARIANT, APP_VERSION: process.env.APP_VERSION };
  const set = (k: keyof typeof old, v: string | undefined) => {
    if (v == null) delete process.env[k];
    else process.env[k] = v;
  };
  set('APP_VARIANT', env.APP_VARIANT);
  set('APP_VERSION', env.APP_VERSION);
  try {
    return getConfig({ config: {} } as Parameters<typeof getConfig>[0]);
  } finally {
    set('APP_VARIANT', old.APP_VARIANT);
    set('APP_VERSION', old.APP_VERSION);
  }
}

const release = (tag: string) => ({
  tag_name: tag,
  html_url: `https://github.com/MechEng70/pitplanner/releases/tag/${tag}`,
  draft: false,
  assets: [
    {
      name: `pitplanner-${tag.slice(1)}.apk`,
      browser_download_url: `https://github.com/MechEng70/pitplanner/releases/download/${tag}/pitplanner-${tag.slice(1)}.apk`,
    },
  ],
});
const LIST = [release('v0.3.0-beta.2'), release('v0.3.0-beta.1'), release('v0.2.0')];
const get = async () => ({ ok: true, json: LIST });

test('a release built with --version 0.3.0-beta.1 reports that version and its versionCode', () => {
  mockConstants.expoConfig = embedded({ APP_VARIANT: 'production', APP_VERSION: '0.3.0-beta.1' });
  const facts = readDeviceFacts();
  expect(facts.appVersion).toBe('0.3.0-beta.1');
  expect(facts.build).toBe(versionCode('0.3.0-beta.1'));
  expect(facts.build).toBe(300301);
});

test('its update check treats the install as a prerelease and offers the next beta', async () => {
  mockConstants.expoConfig = embedded({ APP_VARIANT: 'production', APP_VERSION: '0.3.0-beta.1' });
  const installed = readDeviceFacts().appVersion;
  expect(isPrerelease(installed)).toBe(true);
  const found = await fetchLatest(1000, installed, get);
  expect(found?.latest).toBe('v0.3.0-beta.2');
  expect(availableUpdate(found, installed)).toBe('0.3.0-beta.2');
});

test('regression (0.3.0-alpha.5): with the development config embedded, a beta tester is never offered the next beta', async () => {
  // No APP_VARIANT or APP_VERSION in the Gradle step: app.config.ts's defaults, as 0.3.0-alpha.5 carried.
  mockConstants.expoConfig = embedded({});
  const installed = readDeviceFacts().appVersion;
  expect(installed).not.toBe('0.3.0-beta.1');
  expect(isPrerelease(installed)).toBe(false); // package.json's version, a final release
  expect(availableUpdate(await fetchLatest(1000, installed, get), installed)).toBeNull();
});
