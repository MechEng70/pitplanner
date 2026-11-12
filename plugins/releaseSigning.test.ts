import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyReleaseSigning, MARKER } from './releaseSigning.ts';

// android/app/build.gradle as `expo prebuild` generates it (SDK 58), copied into the fixture.
const generated = readFileSync(new URL('./fixtures/app-build.gradle', import.meta.url), 'utf8');

test('release builds sign with the release config from keystore.properties; debug keeps the debug key', () => {
  const out = applyReleaseSigning(generated);
  const release = out.slice(out.indexOf('    buildTypes {'));
  assert.match(release, /release \{[\s\S]*?signingConfig signingConfigs\.release/);
  assert.match(release, /debug \{\s*signingConfig signingConfigs\.debug/);
  assert.match(out, /rootProject\.file\('\.\.\/keystore\.properties'\)/);
  assert.match(out, /signingConfigs \{[\s\S]*?release \{[\s\S]*?storeFile file\(pitKeystore\['storeFile'\]\)/);
});

test('no secret is ever written into the Gradle file: values are read at build time', () => {
  const out = applyReleaseSigning(generated);
  // Only the debug config has literal passwords (Android's public 'android' debug key).
  assert.doesNotMatch(out, /(store|key)Password '(?!android')/);
  assert.match(out, /storePassword pitKeystore\['storePassword'\]/);
});

test('a release build without keystore.properties fails instead of falling back to the debug key', () => {
  assert.match(applyReleaseSigning(generated), /GradleException\("keystore\.properties/);
});

test('applying twice changes nothing', () => {
  const once = applyReleaseSigning(generated);
  assert.equal(applyReleaseSigning(once), once);
  assert.ok(once.includes(MARKER));
});

test('a template it does not recognize is an error at prebuild, not a silent no-op', () => {
  assert.throws(() => applyReleaseSigning('android {\n}\n'), /withReleaseSigning/);
});
