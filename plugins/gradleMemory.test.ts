import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyGradleMemory, GRADLE_MEMORY } from './gradleMemory.ts';

// gradle.properties as `expo prebuild` generates it (SDK 58), the lines that matter here.
const generated = [
  { type: 'comment', value: 'Default value: -Xmx512m -XX:MaxMetaspaceSize=256m' },
  { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m -XX:MaxMetaspaceSize=512m' },
  { type: 'property', key: 'org.gradle.parallel', value: 'true' },
  { type: 'property', key: 'hermesEnabled', value: 'true' },
];
const value = (items: { type: string; key?: string; value?: string }[], key: string) =>
  items.filter(i => i.type === 'property' && i.key === key).map(i => i.value);

test('the generated heap line is replaced, not duplicated; the other lines stay', () => {
  const out = applyGradleMemory(generated);
  assert.deepEqual(value(out, 'org.gradle.jvmargs'), [GRADLE_MEMORY['org.gradle.jvmargs']]);
  assert.deepEqual(value(out, 'org.gradle.parallel'), ['true']);
  assert.deepEqual(value(out, 'hermesEnabled'), ['true']);
  assert.equal(out.filter(i => i.type === 'comment').length, 1);
});

test('Gradle and Kotlin daemons are capped, workers limited, idle daemons leave', () => {
  const out = applyGradleMemory(generated);
  assert.match(
    value(out, 'org.gradle.jvmargs')[0]!,
    /-Xmx2g .*MaxMetaspaceSize=768m .*ReservedCodeCacheSize=256m .*MaxDirectMemorySize=512m/,
  );
  assert.match(value(out, 'kotlin.daemon.jvmargs')[0]!, /-Xmx1536m/);
  assert.deepEqual(value(out, 'org.gradle.workers.max'), ['6']);
  assert.deepEqual(value(out, 'org.gradle.daemon.idletimeout'), ['600000']);
});

test('applying twice changes nothing more', () => {
  const once = applyGradleMemory(generated);
  assert.deepEqual(applyGradleMemory(once), once);
});
