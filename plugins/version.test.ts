import assert from 'node:assert/strict';
import { test } from 'node:test';
import { versionCode } from './version.ts';

test('a final release is (major*10000 + minor*100 + patch) * 1000 + 999', () => {
  assert.equal(versionCode('0.3.0'), 300999);
  assert.equal(versionCode('1.2.3'), 10203999);
});

test('prereleases: alpha.N is N, beta.N is 300 + N, rc.N is 600 + N', () => {
  assert.equal(versionCode('0.3.0-alpha.1'), 300001);
  assert.equal(versionCode('0.3.0-beta.2'), 300302);
  assert.equal(versionCode('0.3.0-rc.1'), 300601);
});

test('every version sorts above the one before: alpha < beta < rc < final < the next version', () => {
  const inOrder = [
    '0.3.0-alpha.1',
    '0.3.0-alpha.2',
    '0.3.0-alpha.299',
    '0.3.0-beta.1',
    '0.3.0-beta.299',
    '0.3.0-rc.1',
    '0.3.0-rc.299',
    '0.3.0',
    '0.3.1-alpha.1',
    '0.3.1',
    '0.4.0-alpha.1',
    '0.4.0-rc.3',
    '0.4.0',
    '0.99.99',
    '1.0.0-alpha.1',
    '1.0.0',
  ];
  for (let i = 1; i < inOrder.length; i++) {
    const [a, b] = [inOrder[i - 1]!, inOrder[i]!];
    assert.ok(versionCode(a) < versionCode(b), `${a} (${versionCode(a)}) must be below ${b} (${versionCode(b)})`);
  }
});

test('everything from 0.3.0-alpha.1 on is above what is already installed', () => {
  // 0.1.0 = 100 and 0.2.0 = 200 shipped under the old scheme; the first internal 0.3.0-alpha.1 was 300.
  assert.ok(versionCode('0.3.0-alpha.1') > 300);
});

test('the largest version fits in an Android versionCode (max 2100000000)', () => {
  assert.ok(versionCode('209.99.99') <= 2100000000);
  assert.throws(() => versionCode('210.0.0'));
});

test('anything else is refused', () => {
  const bad = ['0.3', '0.3.0.1', 'v0.3.0', '0.3.0-', '0.3.0+build', '0.100.0', '0.1.100'];
  const badPre = ['0.3.0-alpha.0', '0.3.0-alpha.300', '0.3.0-rc.1000', '0.3.0-alpha', '0.3.0-dev.1', '0.3.0-alpha.01'];
  for (const v of [...bad, ...badPre]) assert.throws(() => versionCode(v), undefined, v);
});
