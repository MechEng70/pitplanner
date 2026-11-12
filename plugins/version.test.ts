import assert from 'node:assert/strict';
import { test } from 'node:test';
import { versionCode } from './version.ts';

test('major*10000 + minor*100 + patch', () => {
  assert.equal(versionCode('0.3.0'), 300);
  assert.equal(versionCode('1.2.3'), 10203);
});

test('0.3.0 is above 0.2.0 (200), so the release upgrades 0.2.0 in place', () => {
  assert.ok(versionCode('0.3.0') > 200);
});

test('a prerelease has its release code (T-007: the internal 0.3.0-alpha.1 is 300)', () => {
  assert.equal(versionCode('0.3.0-alpha.1'), 300);
  assert.equal(versionCode('0.3.0-beta.2'), 300);
});

test('anything else is refused', () => {
  for (const v of ['0.3', '0.3.0.1', 'v0.3.0', '0.3.0-', '0.3.0+build', '0.100.0', '0.1.100']) {
    assert.throws(() => versionCode(v), undefined, v);
  }
});
