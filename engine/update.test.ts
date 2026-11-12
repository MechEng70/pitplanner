// Update check (SPEC section 10): version compare, daily throttle, release parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableUpdate, dueForCheck, fromRelease, isNewer, RELEASES_PAGE } from '../src/lib/update.ts';

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
      { name: 'pitplanner-0.2.0.apk', browser_download_url: 'https://example/apk' },
    ],
  };
  assert.deepEqual(fromRelease(rel, 5), { checkedAt: 5, latest: 'v0.2.0', url: 'https://example/apk' });
  assert.equal(fromRelease({ tag_name: 'v0.2.0', html_url: 'h', assets: [] }, 5).url, 'h');
  assert.equal(fromRelease({}, 5).url, RELEASES_PAGE);
  assert.equal(availableUpdate(fromRelease(rel, 5), '0.1.0'), '0.2.0');
  assert.equal(availableUpdate(fromRelease(rel, 5), '0.2.0'), null);
  assert.equal(availableUpdate(null, '0.1.0'), null);
});
