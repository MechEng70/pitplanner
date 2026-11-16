// T-035 (security pass finding 2): explicit backup rules. Android backup stays on for 0.3.0 (Jason,
// 2026-11-16: cook history matters), but only for what is the user's data. Without rules, Auto Backup and
// device-to-device transfer take everything in the app's data folders.
//
// The rules only INCLUDE, so everything not listed here is left out, including anything a later version adds
// (a token store for Home Assistant in 0.4.0 must stay out: Jason, 2026-11-16).
//
// Backed up:
//  - files/SQLite/: the database (expo-sqlite keeps it in files/SQLite: pitplanner.db and its -wal/-shm),
//    which holds the cookers, plan, running cook, cook history, rates and settings (the kv table).
//  - The 0.2.0 data: SharedPreferences "CapacitorStorage" and files/history.json. 0.3.0 imports them once
//    at first start and keeps ".imported" copies. Backed up so a backup taken after the update but before
//    the first start still holds the user's data, and the kept copies stay with it.
// Left out:
//  - The alarm store, SharedPreferences "pit_alarms" and "pit_alarms_meta" in device-protected storage
//    (modules/pit-alarms AlarmStore.kt). Android does back up device-protected storage by default (the
//    device_* domains, API 24 and up); these rules list none, so it is left out. The store is a copy made from
//    the running cook in the database: the app sets the alarms again from it at every start
//    (src/lib/alarmWiring.ts). Restored on a new phone, RestoreReceiver would fire every past alarm at the
//    first boot as "missed" for an old cook.
//  - Caches (never backed up by Android anyway), code_cache and no_backup.
//  - Development build files: expo-dev-launcher and dev-menu settings, React Native's dev settings.
//  - 0.2.0's WebView folder (app_webview): nothing in it is read by 0.3.0.
// Pure (tested without a prebuild): withBackupRules.ts applies it at prebuild.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Names of the two XML resources (res/xml/<name>.xml). */
export const FULL_BACKUP_CONTENT = 'pitplanner_backup_rules';
export const DATA_EXTRACTION_RULES = 'pitplanner_data_extraction_rules';

export type Domain = 'file' | 'sharedpref';
export interface Rule {
  domain: Domain;
  path: string;
}

/** What is backed up; everything else is not. */
export const BACKED_UP: readonly Rule[] = [
  { domain: 'file', path: 'SQLite' },
  { domain: 'file', path: 'history.json' },
  { domain: 'file', path: 'history.json.imported' },
  { domain: 'sharedpref', path: 'CapacitorStorage.xml' },
  { domain: 'sharedpref', path: 'CapacitorStorage.imported.xml' },
];

const HEAD =
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<!-- Written at prebuild by plugins/withBackupRules.ts (T-035); the reasons are in plugins/backupRules.ts. -->\n';
const includes = (indent: string) =>
  BACKED_UP.map(r => `${indent}<include domain="${r.domain}" path="${r.path}" />\n`).join('');

/** android:fullBackupContent, read by Android 11 (API 30) and lower. */
export function fullBackupContentXml(): string {
  return `${HEAD}<full-backup-content>\n${includes('    ')}</full-backup-content>\n`;
}

/** android:dataExtractionRules, read by Android 12 (API 31) and up: cloud backup and device-to-device transfer. */
export function dataExtractionRulesXml(): string {
  const section = (tag: string) => `    <${tag}>\n${includes('        ')}    </${tag}>\n`;
  return `${HEAD}<data-extraction-rules>\n${section('cloud-backup')}${section('device-transfer')}</data-extraction-rules>\n`;
}

interface ManifestLike {
  manifest: { application?: { $?: Record<string, string | undefined> }[] };
}

/** The application element keeps backup on and points at the two rule files. */
export function addBackupRules<T extends ManifestLike>(manifest: T): T {
  const app = manifest.manifest.application?.[0];
  if (!app) throw new Error('withBackupRules: no <application> in AndroidManifest.xml');
  app.$ = {
    ...app.$,
    'android:allowBackup': 'true',
    'android:fullBackupContent': `@xml/${FULL_BACKUP_CONTENT}`,
    'android:dataExtractionRules': `@xml/${DATA_EXTRACTION_RULES}`,
  };
  return manifest;
}

/** Writes the two rule files into `resDir`/xml (the app's res folder). */
export function writeBackupRules(resDir: string): void {
  const dir = join(resDir, 'xml');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${FULL_BACKUP_CONTENT}.xml`), fullBackupContentXml());
  writeFileSync(join(dir, `${DATA_EXTRACTION_RULES}.xml`), dataExtractionRulesXml());
}
