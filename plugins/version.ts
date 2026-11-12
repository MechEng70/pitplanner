// Android versionCode from the app version (TECH-DESIGN section 12). Used by app.config.ts and
// tools/release.sh. Pure: node:test runs it (plugins/version.test.ts).

/**
 * 0.3.0 -> 300 (major*10000 + minor*100 + patch). Must stay above 0.2.0's 200 so the release upgrades in
 * place. A prerelease (0.3.0-alpha.1, internal builds only) has its release's code.
 */
export function versionCode(version: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)(-(alpha|beta|rc)\.\d+)?$/.exec(version);
  if (!m) throw new Error(`version must be major.minor.patch (or -alpha.N, -beta.N, -rc.N), got ${version}`);
  const [major, minor, patch] = m.slice(1, 4).map(Number) as [number, number, number];
  if (minor > 99 || patch > 99) throw new Error(`minor and patch must be under 100, got ${version}`);
  return major * 10000 + minor * 100 + patch;
}

/** The version to build: package.json's, or APP_VERSION for an internal prerelease build (release.sh --version). */
export function appVersion(pkgVersion: string, override: string | undefined): string {
  const v = override || pkgVersion;
  versionCode(v);
  return v;
}
