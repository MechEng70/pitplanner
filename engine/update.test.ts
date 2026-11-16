// Update check (SPEC section 10): version compare, daily throttle, release parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableUpdate,
  dueForCheck,
  fetchLatest,
  fromRelease,
  isNewer,
  isPrerelease,
  newestRelease,
  RELEASES_API,
  RELEASES_PAGE,
} from '../src/lib/update.ts';

const DAY = 24 * 3_600_000;

test('update: version compare', () => {
  assert.equal(isNewer('v0.2.0', '0.1.0'), true);
  assert.equal(isNewer('0.1.10', '0.1.9'), true);
  assert.equal(isNewer('v1.0', '1.0.0'), false);
  assert.equal(isNewer('v0.1.0', '0.1.0'), false);
  assert.equal(isNewer('v0.0.9', '0.1.0'), false);
  assert.equal(isNewer('beta', '0.1.0'), false);
});

test('update: at most daily', () => {
  assert.equal(dueForCheck(null, 0), true);
  assert.equal(dueForCheck({ checkedAt: 1000, latest: null, url: null }, 1000 + DAY - 1), false);
  assert.equal(dueForCheck({ checkedAt: 1000, latest: null, url: null }, 1000 + DAY), true);
  assert.equal(dueForCheck({ checkedAt: 1000, latest: null, url: null }, 0), true);
});

test('update: release json gives the APK link, else the release page', () => {
  const rel = {
    tag_name: 'v0.2.0',
    html_url: 'https://github.com/MechEng70/pitplanner/releases/tag/v0.2.0',
    assets: [
      { name: 'notes.txt', browser_download_url: 'x' },
      {
        name: 'pitplanner-0.2.0.apk',
        browser_download_url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.2.0/pitplanner-0.2.0.apk',
      },
    ],
  };
  assert.deepEqual(fromRelease(rel, 5), {
    checkedAt: 5,
    latest: 'v0.2.0',
    url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.2.0/pitplanner-0.2.0.apk',
  });
  const page = 'https://github.com/MechEng70/pitplanner/releases/tag/v0.2.0';
  assert.equal(fromRelease({ tag_name: 'v0.2.0', html_url: page, assets: [] }, 5).url, page);
  assert.equal(fromRelease({}, 5).url, RELEASES_PAGE);
  assert.equal(availableUpdate(fromRelease(rel, 5), '0.1.0'), '0.2.0');
  assert.equal(availableUpdate(fromRelease(rel, 5), '0.2.0'), null);
  assert.equal(availableUpdate(null, '0.1.0'), null);
});

// T-032: prereleases compared by semver, the release list, and the request itself.

test('update: prereleases sort by semver, below their final release', () => {
  const order = [
    '0.2.0',
    '0.3.0-alpha.1',
    '0.3.0-alpha.2',
    '0.3.0-alpha.10',
    '0.3.0-beta.1',
    '0.3.0-rc.1',
    '0.3.0',
    '0.3.1-alpha.1',
    '0.3.1',
  ];
  for (let i = 0; i < order.length; i++)
    for (let j = 0; j < order.length; j++)
      assert.equal(isNewer(`v${order[i]}`, order[j]!), i > j, `${order[i]} newer than ${order[j]}`);
  // semver.org section 11: numbers below words, fewer identifiers below more.
  assert.equal(isNewer('1.0.0-alpha.beta', '1.0.0-alpha.1'), true);
  assert.equal(isNewer('1.0.0-alpha.1', '1.0.0-alpha'), true);
  assert.equal(isNewer('1.0.0-alpha', '1.0.0-alpha.1'), false);
  // Build metadata does not count; a broken tag is never newer.
  assert.equal(isNewer('0.3.0+build.7', '0.3.0'), false);
  assert.equal(isNewer('0.4.0+build.7', '0.3.0'), true);
  assert.equal(isNewer('0.4.0-', '0.3.0'), false);
  assert.equal(isNewer('0.4.x', '0.3.0'), false);
  assert.equal(isNewer('1.2.3.4', '0.3.0'), false);
  assert.equal(isNewer('', '0.3.0'), false);
});

const release = (tag: string, extra: object = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/MechEng70/pitplanner/releases/tag/${tag}`,
  prerelease: tag.includes('-'),
  draft: false,
  assets: [
    {
      name: `pitplanner-${tag.slice(1)}.apk`,
      browser_download_url: `https://github.com/MechEng70/pitplanner/releases/download/${tag}/pitplanner-${tag.slice(1)}.apk`,
    },
  ],
  ...extra,
});

test('update: the newest release of the list is the highest version on the installed path', () => {
  // GitHub lists by date: a 0.3.1 fix published after the 0.4.0 beta must not hide the beta.
  const list = [release('v0.3.1'), release('v0.4.0-beta.1'), release('v0.3.0'), release('v0.3.0-rc.1')];
  // A prerelease install: any version counts.
  assert.equal(newestRelease(list, '0.3.0-beta.1')?.tag_name, 'v0.4.0-beta.1');
  assert.equal(newestRelease([release('v0.3.0-rc.1'), release('v0.3.0')], '0.3.0-beta.1')?.tag_name, 'v0.3.0');
  // A final install: final releases only (Jason, 2026-11-15).
  assert.equal(newestRelease(list, '0.3.0')?.tag_name, 'v0.3.1');
  assert.equal(newestRelease([release('v0.4.0-alpha.1'), release('v0.4.0-rc.2')], '0.3.0'), null);
  // Drafts, tags that are not versions and junk entries are skipped.
  const messy = [release('v9.0.0', { draft: true }), release('nightly'), null, 'x', {}, release('v0.3.0')];
  assert.equal(newestRelease(messy, '0.2.0')?.tag_name, 'v0.3.0');
  assert.equal(newestRelease(messy, '0.3.0-rc.1')?.tag_name, 'v0.3.0');
  assert.equal(newestRelease([], '0.3.0'), null);
  assert.equal(newestRelease({ message: 'Not Found' }, '0.3.0'), null);
  assert.equal(newestRelease(null, '0.3.0'), null);
});

test('update: a final install is never offered a prerelease; a prerelease install is offered any newer version', () => {
  const found = (latest: string) => ({ checkedAt: 1, latest, url: null });
  assert.equal(isPrerelease('0.3.0'), false);
  assert.equal(isPrerelease('v0.3.0-beta.1'), true);
  assert.equal(isPrerelease('0.3.0+build.7'), false);
  assert.equal(isPrerelease('beta'), false);
  // On 0.3.0: alpha, beta and rc of a later version are not updates; the later final is.
  for (const pre of ['v0.3.1-alpha.1', 'v0.4.0-beta.1', 'v1.0.0-rc.1'])
    assert.equal(availableUpdate(found(pre), '0.3.0'), null, pre);
  assert.equal(availableUpdate(found('v0.3.1'), '0.3.0'), '0.3.1');
  // On 0.3.0-beta.1: the next beta, the rc and the final are all updates; older ones are not.
  for (const next of ['0.3.0-beta.2', '0.3.0-rc.1', '0.3.0', '0.3.1-alpha.1'])
    assert.equal(availableUpdate(found(`v${next}`), '0.3.0-beta.1'), next);
  assert.equal(availableUpdate(found('v0.3.0-alpha.9'), '0.3.0-beta.1'), null);
  assert.equal(availableUpdate(found('v0.3.0-beta.1'), '0.3.0-beta.1'), null);
});

/** A scripted GetJson that records each request. */
function http(answer: { ok: boolean; json: unknown } | Error) {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const get = async (url: string, headers: Record<string, string>) => {
    requests.push({ url, headers });
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { get, requests };
}

test('update: a newer release is found, with its APK link', async () => {
  const h = http({ ok: true, json: [release('v0.4.0-beta.1'), release('v0.3.1'), release('v0.3.0')] });
  // A final install gets the newer final, a beta install the newer beta.
  const u = await fetchLatest(50, '0.3.0', h.get);
  assert.deepEqual(u, {
    checkedAt: 50,
    latest: 'v0.3.1',
    url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.3.1/pitplanner-0.3.1.apk',
  });
  assert.equal(availableUpdate(u, '0.3.0'), '0.3.1');
  const b = await fetchLatest(50, '0.3.0-beta.1', h.get);
  assert.deepEqual(b, {
    checkedAt: 50,
    latest: 'v0.4.0-beta.1',
    url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.4.0-beta.1/pitplanner-0.4.0-beta.1.apk',
  });
  assert.equal(availableUpdate(b, '0.3.0-beta.1'), '0.4.0-beta.1');
});

test('update: the same release is not an update', async () => {
  const list = [release('v0.4.0-beta.1'), release('v0.3.0'), release('v0.2.0')];
  const u = await fetchLatest(50, '0.3.0', http({ ok: true, json: list }).get);
  assert.deepEqual(u, {
    checkedAt: 50,
    latest: 'v0.3.0',
    url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.3.0/pitplanner-0.3.0.apk',
  });
  assert.equal(availableUpdate(u, '0.3.0'), null);
});

test('update: a failed check gives nothing to save, so it does not count as the check of the day', async () => {
  // Offline, rate limited (403), or an answer that is not a release list (Jason, 2026-11-15).
  assert.equal(await fetchLatest(50, '0.3.0', http(new TypeError('Network request failed')).get), null);
  assert.equal(await fetchLatest(50, '0.3.0', http({ ok: false, json: null }).get), null);
  assert.equal(await fetchLatest(50, '0.3.0', http({ ok: true, json: { message: 'x' } }).get), null);
  // What the last good check saved is untouched, so the next launch or resume is still due or not as before.
  const prev = { checkedAt: 10, latest: 'v0.4.0', url: 'https://example/apk' };
  assert.equal(dueForCheck(prev, 10 + DAY), true);
  // No release at all (an empty list) is an answer: nothing to offer, and the day's wait starts.
  const none = await fetchLatest(50, '0.3.0', http({ ok: true, json: [] }).get);
  assert.deepEqual(none, { checkedAt: 50, latest: null, url: null });
  assert.equal(dueForCheck(none, 50 + DAY - 1), false);
});

test('update: one anonymous request to the release list, with nothing about the user', async () => {
  const h = http({ ok: true, json: [] });
  await fetchLatest(50, '0.3.0', h.get);
  assert.deepEqual(h.requests, [{ url: RELEASES_API, headers: { Accept: 'application/vnd.github+json' } }]);
  assert.equal(RELEASES_API, 'https://api.github.com/repos/MechEng70/pitplanner/releases?per_page=30');
});
