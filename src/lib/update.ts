// In-app update check (SPEC section 10): the newest GitHub release of MechEng70/pitplanner on the installed
// version's path, at most daily. A final install is offered final releases only; a prerelease install
// (alpha, beta, rc) is offered any newer version (Jason, 2026-11-15). Sends nothing about the user; GitHub
// sees an anonymous API request.
// Pure: the request and the time are passed in (src/lib/updateWiring.ts runs it on launch and on resume).
import type { GetJson } from '../platform/types.ts';

export const RELEASES_PAGE = 'https://github.com/MechEng70/pitplanner/releases/latest';
/** The list, not `/releases/latest`: GitHub leaves prereleases out of "latest". Newest first. */
export const RELEASES_API = 'https://api.github.com/repos/MechEng70/pitplanner/releases?per_page=30';
const DAY = 24 * 3_600_000;

export interface UpdateInfo {
  checkedAt: number;
  latest: string | null;
  url: string | null;
}

interface Version {
  core: number[];
  /** Prerelease identifiers ("alpha", "1"); empty for a final release. */
  pre: string[];
}

const DIGITS = /^\d+$/;

/** "v0.3.0-beta.2" or "1.0" (missing parts are 0); build metadata after "+" is ignored. Null when not a version. */
function parseVersion(v: string): Version | null {
  const text = v.trim().replace(/^v/i, '').split('+')[0] ?? '';
  const dash = text.indexOf('-');
  const core = (dash < 0 ? text : text.slice(0, dash)).split('.');
  const pre = dash < 0 ? [] : text.slice(dash + 1).split('.');
  if (core.length > 3 || !core.every(n => DIGITS.test(n))) return null;
  if (!pre.every(id => /^[0-9A-Za-z-]+$/.test(id))) return null;
  return { core: core.map(Number), pre };
}

/** Semver precedence (semver.org section 11): below 0 when a is older, above 0 when newer, 0 when equal. */
function compare(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    const d = (a.core[i] ?? 0) - (b.core[i] ?? 0);
    if (d) return d;
  }
  // A prerelease comes before its final release.
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i],
      y = b.pre[i];
    if (x === undefined) return -1; // fewer identifiers, all equal so far: older
    if (y === undefined) return 1;
    if (x === y) continue;
    const xn = DIGITS.test(x),
      yn = DIGITS.test(y);
    if (xn && yn) return Number(x) - Number(y);
    if (xn !== yn) return xn ? -1 : 1; // numbers sort below words
    return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * "v0.2.0" vs "0.1.0": true when latest is newer, by semver, so 0.3.0-alpha.2 < 0.3.0-beta.1 < 0.3.0-rc.1 <
 * 0.3.0 < 0.3.1-alpha.1. Anything unparsable is not newer.
 */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest),
    b = parseVersion(current);
  return a !== null && b !== null && compare(a, b) > 0;
}

/** True for a version with a prerelease part ("0.3.0-beta.1"); false for a final release or not a version. */
export function isPrerelease(v: string): boolean {
  return (parseVersion(v)?.pre.length ?? 0) > 0;
}

/** Whether a build on `current` is told about `candidate`: newer, and a prerelease only for a prerelease install. */
const offered = (candidate: string, current: string) =>
  isNewer(candidate, current) && (isPrerelease(current) || !isPrerelease(candidate));

/** At most once a day; a clock set backward also allows a check. */
export const dueForCheck = (u: UpdateInfo | null, now: number) => !u || now - u.checkedAt >= DAY || now < u.checkedAt;

/** The fields read from a GitHub release; anything may be missing. */
interface ReleaseJson {
  tag_name?: unknown;
  html_url?: string;
  draft?: unknown;
  assets?: { name?: unknown; browser_download_url?: string }[];
}

/** One path segment of a tag or file name: letters, digits, dots, dashes, underscores; never `.` or `..`. */
const SEG = '[A-Za-z0-9][A-Za-z0-9._-]*';
const RELEASE_LINK = new RegExp(
  `^https://github\\.com/MechEng70/pitplanner/releases/(?:download/${SEG}/${SEG}\\.apk|tag/${SEG}|latest)$`,
);

/**
 * The link itself when it is one of Pit Planner's own GitHub release links, else null (T-035, security pass
 * finding 8). The update check opens nothing else. The three shapes, as GitHub's API and RELEASES_PAGE give
 * them:
 *   https://github.com/MechEng70/pitplanner/releases/download/<tag>/<file>.apk   (an asset's download)
 *   https://github.com/MechEng70/pitplanner/releases/tag/<tag>                   (a release's page)
 *   https://github.com/MechEng70/pitplanner/releases/latest                      (RELEASES_PAGE)
 * A download link redirects to GitHub's file host; the browser follows that, the app only opens github.com.
 * Checked on the text, not with URL: React Native's URL does not parse or normalize like a browser.
 */
export function releaseLink(url: unknown): string | null {
  return typeof url === 'string' && RELEASE_LINK.test(url) ? url : null;
}

/**
 * The release's APK download link when there is one, else the release page, else the releases page. A link
 * that is not one of Pit Planner's own GitHub release links counts as missing (releaseLink).
 */
export function fromRelease(json: ReleaseJson | null | undefined, now: number): UpdateInfo {
  const apk = (json?.assets ?? []).find(a => typeof a?.name === 'string' && a.name.endsWith('.apk'));
  return {
    checkedAt: now,
    latest: typeof json?.tag_name === 'string' ? json.tag_name : null,
    url: releaseLink(apk?.browser_download_url) ?? releaseLink(json?.html_url) ?? RELEASES_PAGE,
  };
}

/**
 * The highest version in a GitHub release list on the path of the installed version `current`: prereleases
 * count only when `current` is one. Drafts and tags that are not versions are skipped. Null when there is
 * none (no release yet, or not a list).
 */
export function newestRelease(list: unknown, current: string): ReleaseJson | null {
  const finalsOnly = !isPrerelease(current);
  if (!Array.isArray(list)) return null;
  let best: { release: ReleaseJson; version: Version } | null = null;
  for (const item of list as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const release = item as ReleaseJson;
    if (release.draft === true || typeof release.tag_name !== 'string') continue;
    const version = parseVersion(release.tag_name);
    if (version && finalsOnly && version.pre.length) continue;
    if (version && (!best || compare(version, best.version) > 0)) best = { release, version };
  }
  return best?.release ?? null;
}

/**
 * One anonymous request for the release list. Never throws. Null when the check failed (offline, rate
 * limited, an answer that cannot be read): nothing is saved, so the last result stays and the check is tried
 * again at the next launch or resume. Only an answer starts the day's wait.
 */
export async function fetchLatest(now: number, current: string, get: GetJson): Promise<UpdateInfo | null> {
  try {
    const r = await get(RELEASES_API, { Accept: 'application/vnd.github+json' });
    if (!r.ok || !Array.isArray(r.json)) return null;
    const newest = newestRelease(r.json, current);
    return newest ? fromRelease(newest, now) : { checkedAt: now, latest: null, url: null };
  } catch {
    return null;
  }
}

/** Version text to show when an update is available, else null. */
export const availableUpdate = (u: UpdateInfo | null, current: string) =>
  u?.latest && offered(u.latest, current) ? u.latest.replace(/^v/i, '') : null;
