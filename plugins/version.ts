// Android versionCode from the app version (TECH-DESIGN section 12). Used by app.config.ts and
// tools/release.sh. Pure: node:test runs it (plugins/version.test.ts).

/** Where each prerelease kind starts inside a version's block of 1000 codes; N is 1 to 299. */
const STAGE = { alpha: 0, beta: 300, rc: 600 } as const;
const FINAL = 999;
const MAX_N = 299;
/** Android's limit is 2100000000: major 209 is the last whose final release fits. */
const MAX_MAJOR = 209;

/**
 * (major*10000 + minor*100 + patch) * 1000 + stage, where stage is N for alpha.N, 300 + N for beta.N,
 * 600 + N for rc.N and 999 for the final release:
 *   0.3.0-alpha.1 300001 < 0.3.0-beta.1 300301 < 0.3.0-rc.1 300601 < 0.3.0 300999 < 0.3.1-alpha.1 301001
 * So a prerelease always installs under its final release and every version installs over the one before.
 * 0.1.0 (100) and 0.2.0 (200) shipped under the old scheme and stay below everything here.
 */
export function versionCode(version: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.([1-9]\d*))?$/.exec(version);
  if (!m) throw new Error(`version must be major.minor.patch (or -alpha.N, -beta.N, -rc.N), got ${version}`);
  const [major, minor, patch] = m.slice(1, 4).map(Number) as [number, number, number];
  if (major > MAX_MAJOR) throw new Error(`major must be ${MAX_MAJOR} or less, got ${version}`);
  if (minor > 99 || patch > 99) throw new Error(`minor and patch must be under 100, got ${version}`);
  const kind = m[4] as keyof typeof STAGE | undefined;
  const n = Number(m[5]);
  if (kind && n > MAX_N) throw new Error(`prerelease number must be 1 to ${MAX_N}, got ${version}`);
  return (major * 10000 + minor * 100 + patch) * 1000 + (kind ? STAGE[kind] + n : FINAL);
}

/** The version to build: package.json's, or APP_VERSION for an internal prerelease build (release.sh --version). */
export function appVersion(pkgVersion: string, override: string | undefined): string {
  const v = override || pkgVersion;
  versionCode(v);
  return v;
}
