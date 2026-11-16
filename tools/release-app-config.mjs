// The app config a release APK carries, `assets/app.config` (T-035, security pass finding 1). Called by
// tools/release.sh in its verify step and in `--verify`.
// Usage: unzip -p <apk> assets/app.config | node tools/release-app-config.mjs <version> <versionCode> <appId>
//
// expo-constants writes that file during the Gradle build, not at prebuild: its Gradle task evaluates
// app.config.ts again with the environment Gradle runs in. `Constants.expoConfig` reads it at run time: Gear's
// version line, the update check (a prerelease install is offered later prereleases), Export my data and
// Send to developer. 0.3.0-alpha.5 was built with APP_VARIANT and APP_VERSION on the prebuild only, so its
// manifest said 0.3.0-alpha.5 while this file said 0.2.0, build 200999, variant development.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * What is wrong with the embedded app config, one line each; empty when it matches the release asked for:
 * version, android.versionCode, android.package and extra.variant "production".
 */
export function appConfigProblems(text, want) {
  let c;
  try {
    c = JSON.parse(text);
  } catch {
    return ['assets/app.config is missing or not JSON'];
  }
  if (!c || typeof c !== 'object') return ['assets/app.config is not an object'];
  const problems = [];
  const check = (what, got, expected) => {
    if (got !== expected) problems.push(`${what} is ${JSON.stringify(got)}, must be ${JSON.stringify(expected)}`);
  };
  check('version', c.version, want.version);
  check('android.versionCode', c.android?.versionCode, want.versionCode);
  check('android.package', c.android?.package, want.appId);
  check('extra.variant', c.extra?.variant, 'production');
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, code, appId] = process.argv.slice(2);
  if (!version || !code || !appId) {
    console.error('usage: node tools/release-app-config.mjs <version> <versionCode> <appId> < app.config');
    process.exit(2);
  }
  const problems = appConfigProblems(readFileSync(0, 'utf8'), { version, versionCode: Number(code), appId });
  if (problems.length) {
    console.error(`WRONG APP CONFIG (assets/app.config, what the app reads at run time): ${problems.join('; ')}`);
    process.exit(1);
  }
  console.log(`app config ok: version ${version}, versionCode ${code}, ${appId}, variant production`);
}
