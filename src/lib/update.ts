// In-app update check (SPEC section 10): the latest GitHub release of MechEng70/pitplanner, at most daily.
// Sends nothing about the user; GitHub sees an anonymous API request.

export const RELEASES_PAGE = 'https://github.com/MechEng70/pitplanner/releases/latest';
const API = 'https://api.github.com/repos/MechEng70/pitplanner/releases/latest';
const DAY = 24 * 3_600_000;

export interface UpdateInfo { checkedAt: number; latest: string | null; url: string | null }

/** "v0.2.0" vs "0.1.0": true when latest is newer. Anything unparsable is not newer. */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.trim().replace(/^v/i, '').split('-')[0].split('.').map(n => Number(n));
  const a = parse(latest), b = parse(current);
  if (a.some(n => !Number.isInteger(n)) || b.some(n => !Number.isInteger(n))) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d > 0;
  }
  return false;
}

/** At most once a day; a clock set backward also allows a check. */
export const dueForCheck = (u: UpdateInfo | null, now: number) => !u || now - u.checkedAt >= DAY || now < u.checkedAt;

/** The release's APK download link when there is one, else the release page. */
export function fromRelease(json: any, now: number): UpdateInfo {
  const apk = (json?.assets ?? []).find((a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk'));
  return { checkedAt: now, latest: typeof json?.tag_name === 'string' ? json.tag_name : null, url: apk?.browser_download_url ?? json?.html_url ?? RELEASES_PAGE };
}

export async function fetchLatest(now: number, prev: UpdateInfo | null): Promise<UpdateInfo> {
  try {
    const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return { ...(prev ?? { latest: null, url: null }), checkedAt: now }; // no release yet, or rate limited
    return fromRelease(await r.json(), now);
  } catch {
    return { ...(prev ?? { latest: null, url: null }), checkedAt: now };  // offline: try again tomorrow
  }
}

/** Version text to show when an update is available, else null. */
export const availableUpdate = (u: UpdateInfo | null, current: string) =>
  u?.latest && isNewer(u.latest, current) ? u.latest.replace(/^v/i, '') : null;
