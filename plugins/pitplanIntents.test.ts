import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addPitplanIntents, type ManifestLike } from './pitplanIntents.ts';

// AndroidManifest.xml as `expo prebuild` generates it (SDK 58), the parts that matter here.
const LAUNCHER = {
  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
};
const manifest = (): ManifestLike => ({
  manifest: {
    application: [
      {
        activity: [
          { $: { 'android:name': '.MainActivity', 'android:exported': 'true' }, 'intent-filter': [LAUNCHER] },
          { $: { 'android:name': 'com.example.Other' } },
        ],
      },
    ],
  },
});
const activity = (m: ManifestLike, name: string) =>
  m.manifest.application![0]!.activity!.find(a => a.$['android:name'] === name)!;
const filters = (m: ManifestLike) => activity(m, '.MainActivity')['intent-filter']!;
const values = (f: { data?: { $: Record<string, string | undefined> }[] }, key: string) =>
  (f.data ?? []).map(d => d.$[`android:${key}`]).filter(v => v != null);
const names = (xs?: { $: Record<string, string | undefined> }[]) => (xs ?? []).map(x => x.$['android:name']);

test('the main activity gets the three .pitplan filters; the launcher filter stays', () => {
  const out = filters(addPitplanIntents(manifest()));
  assert.equal(out.length, 4);
  assert.deepEqual(out[0], LAUNCHER);
  assert.deepEqual(
    out.slice(1).map(f => names(f.action)),
    [['android.intent.action.VIEW'], ['android.intent.action.VIEW'], ['android.intent.action.SEND']],
  );
});

test('only the main activity is touched', () => {
  const out = addPitplanIntents(manifest());
  assert.equal(activity(out, 'com.example.Other')['intent-filter'], undefined);
});

test('the filters are as narrow as 0.2.0 or narrower: DEFAULT only, never BROWSABLE', () => {
  for (const f of filters(addPitplanIntents(manifest())).slice(1)) {
    assert.deepEqual(names(f.category), ['android.intent.category.DEFAULT']);
  }
});

test('VIEW takes content:// and file:// only, never http or a custom scheme', () => {
  const [, byType, byName] = filters(addPitplanIntents(manifest()));
  assert.deepEqual(values(byType!, 'scheme'), ['content', 'file']);
  assert.deepEqual(values(byName!, 'scheme'), ['content', 'file']);
});

test('by type: JSON, octet-stream and x-pitplan, no wildcard', () => {
  const [, byType, , send] = filters(addPitplanIntents(manifest()));
  const types = ['application/json', 'application/octet-stream', 'application/x-pitplan'];
  assert.deepEqual(values(byType!, 'mimeType'), types);
  assert.deepEqual(values(send!, 'mimeType'), types);
  assert.deepEqual(values(send!, 'scheme'), []);
});

test('any type is taken only when the path ends in .pitplan', () => {
  const byName = filters(addPitplanIntents(manifest()))[2]!;
  assert.deepEqual(values(byName, 'mimeType'), ['*/*']);
  const patterns = values(byName, 'pathPattern');
  assert.equal(patterns.length, 3);
  // In the XML each literal dot is written `\\.`; every pattern ends with the extension.
  for (const p of patterns) assert.ok(p!.endsWith('\\\\.pitplan'), p);
});

test('they are added once, however often the plugin runs', () => {
  const out = addPitplanIntents(addPitplanIntents(manifest()));
  assert.equal(filters(out).length, 4);
});

test('a manifest without the main activity is an error, not a silent skip', () => {
  assert.throws(() => addPitplanIntents({ manifest: { application: [{ activity: [] }] } }), /MainActivity/);
});
