import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { XML } from 'expo/config-plugins';
import {
  addBackupRules,
  BACKED_UP,
  DATA_EXTRACTION_RULES,
  dataExtractionRulesXml,
  FULL_BACKUP_CONTENT,
  fullBackupContentXml,
  writeBackupRules,
} from './backupRules.ts';

// The <application> element as `expo prebuild` generates it (SDK 58): backup on, no rules.
const manifest = () => ({
  manifest: {
    application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } }],
  },
});
type Node = { $?: Record<string, string>; include?: Node[]; exclude?: Node[] } & Record<string, unknown>;
const rulesOf = (n: Node) => (n.include ?? []).map(i => `${i.$!.domain}:${i.$!.path}`);

test('regression (finding 2): backup stays on and points at explicit rules for every Android version', () => {
  const app = addBackupRules(manifest()).manifest.application[0]!.$;
  assert.equal(app['android:allowBackup'], 'true');
  assert.equal(app['android:fullBackupContent'], '@xml/pitplanner_backup_rules');
  assert.equal(app['android:dataExtractionRules'], '@xml/pitplanner_data_extraction_rules');
  assert.equal(app['android:name'], '.MainApplication');
});

test('running the plugin twice changes nothing more', () => {
  const once = JSON.stringify(addBackupRules(manifest()));
  assert.equal(JSON.stringify(addBackupRules(addBackupRules(manifest()))), once);
});

test('a manifest without <application> is an error, not a silent skip', () => {
  assert.throws(() => addBackupRules({ manifest: {} }), /application/);
});

test('the database and the 0.2.0 data are backed up, nothing else', () => {
  assert.deepEqual(
    BACKED_UP.map(r => `${r.domain}:${r.path}`),
    [
      'file:SQLite',
      'file:history.json',
      'file:history.json.imported',
      'sharedpref:CapacitorStorage.xml',
      'sharedpref:CapacitorStorage.imported.xml',
    ],
  );
});

test('Android 11 and lower: <full-backup-content> includes only those', async () => {
  const xml = (await XML.parseXMLAsync(fullBackupContentXml())) as { 'full-backup-content': Node };
  const root = xml['full-backup-content'];
  assert.deepEqual(
    rulesOf(root),
    BACKED_UP.map(r => `${r.domain}:${r.path}`),
  );
  assert.equal(root.exclude, undefined);
});

test('Android 12 and up: cloud backup and device-to-device transfer include the same, only those', async () => {
  const xml = (await XML.parseXMLAsync(dataExtractionRulesXml())) as { 'data-extraction-rules': Node };
  const root = xml['data-extraction-rules'];
  const want = BACKED_UP.map(r => `${r.domain}:${r.path}`);
  for (const section of ['cloud-backup', 'device-transfer']) {
    const s = (root[section] as Node[] | undefined)?.[0];
    assert.ok(s, `${section} is missing`);
    assert.deepEqual(rulesOf(s), want, section);
  }
});

test('left out: device-protected storage (the alarm store), caches, and any secret store', () => {
  for (const xml of [fullBackupContentXml(), dataExtractionRulesXml()]) {
    // An include-only rule file backs up nothing it does not name. No device_* domain is named, so the alarm
    // store (pit_alarms, pit_alarms_meta, device-protected SharedPreferences) is not backed up.
    assert.doesNotMatch(xml, /domain="device_/);
    assert.doesNotMatch(xml, /pit_alarms/);
    assert.doesNotMatch(xml, /domain="(root|database|external)"/);
    // 0.4.0 keeps the Home Assistant token in a store of its own: it must never be backed up (Jason,
    // 2026-11-16). Only the two 0.2.0 SharedPreferences files are named.
    assert.doesNotMatch(xml, /SecureStore|secure|token/i);
    const prefs = [...xml.matchAll(/domain="sharedpref" path="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual([...new Set(prefs)], ['CapacitorStorage.xml', 'CapacitorStorage.imported.xml']);
  }
});

test('the two files are written to res/xml under the names the manifest uses', () => {
  const res = mkdtempSync(join(tmpdir(), 'res-'));
  writeBackupRules(res);
  writeBackupRules(res); // a second prebuild overwrites them
  assert.equal(readFileSync(join(res, 'xml', `${FULL_BACKUP_CONTENT}.xml`), 'utf8'), fullBackupContentXml());
  assert.equal(readFileSync(join(res, 'xml', `${DATA_EXTRACTION_RULES}.xml`), 'utf8'), dataExtractionRulesXml());
});
