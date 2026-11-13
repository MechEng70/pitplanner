// The files the `legacy-import` device test puts on the emulator (tools/device/fixtures/legacy-020) are
// generated from the same fixture the import tests use. This test fails when they drift; regenerate with
//   UPDATE_DEVICE_FIXTURES=1 npx jest src/db/fixtures
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { legacyHistoryJson, legacyPrefs } from './legacy020';

const DIR = join(__dirname, '../../../tools/device/fixtures/legacy-020');
const STARTED = Date.UTC(2026, 10, 14, 11, 0);

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A SharedPreferences file as Android writes it. */
const prefsXml = (prefs: Record<string, string>) =>
  `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n${Object.entries(prefs)
    .map(([k, v]) => `    <string name="${k}">${escape(v)}</string>\n`)
    .join('')}</map>\n`;

const full = legacyPrefs(STARTED);
const variants: Record<string, { prefs: Record<string, string>; history: string }> = {
  // Everything readable.
  full: { prefs: full, history: legacyHistoryJson() },
  // TASKS T-012 acceptance: a corrupted gear entry.
  partial: { prefs: { ...full, gear: '{"smoker":{"id":"pb820","name":' }, history: legacyHistoryJson() },
  // Data is there, none of it readable.
  fresh: { prefs: Object.fromEntries(Object.keys(full).map(k => [k, '{broken'])), history: 'not a history file' },
};

test.each(Object.keys(variants))('device fixture "%s" matches the import fixture', name => {
  const v = variants[name]!;
  const files = { 'CapacitorStorage.xml': prefsXml(v.prefs), 'history.json': v.history };
  for (const [file, text] of Object.entries(files)) {
    const path = join(DIR, name, file);
    if (process.env.UPDATE_DEVICE_FIXTURES) {
      mkdirSync(join(DIR, name), { recursive: true });
      writeFileSync(path, text);
    }
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(text);
  }
});
