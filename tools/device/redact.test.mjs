import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redact } from './redact.mjs';

// Fake values with the shapes of real secrets (no real token anywhere in the repo).
const jwt = ['eyJ0eXAiOiJKV1QifQ', 'eyJzdWIiOiJ4In0', 'c2lnbmF0dXJlLXBhcnQtZmFrZQ'].join('.');

test('JWTs are replaced, the rest of the line is kept', () => {
  assert.equal(redact(`I/Auth: token ${jwt} ok`), 'I/Auth: token [REDACTED] ok');
});

test('a JWT split by a log wrap at a dot is still replaced', () => {
  assert.equal(redact(`D/X: ${jwt.slice(0, 20)}`), 'D/X: [REDACTED]');
});

test('bearer, authorization headers and token parameters', () => {
  assert.equal(redact('Authorization: Bearer abc.def-123_456'), 'Authorization: [REDACTED]');
  assert.equal(redact('url ?access_token=AbC123&x=1'), 'url ?access_token=[REDACTED]&x=1');
  assert.equal(redact('"refresh_token":"0.AXYz-123"'), '"refresh_token":"[REDACTED]"');
  assert.equal(redact('id_token: abc'), 'id_token: [REDACTED]');
  assert.equal(redact('api_key=sk_live_123456'), 'api_key=[REDACTED]');
});

test('long opaque strings (keys, hashes) are replaced; normal words and numbers stay', () => {
  assert.equal(redact(`k=${'a1B2'.repeat(10)}`), 'k=[REDACTED]');
  assert.equal(
    redact('E/ReactNativeJS: TypeError: undefined is not a function at 1794508406'),
    'E/ReactNativeJS: TypeError: undefined is not a function at 1794508406',
  );
});
