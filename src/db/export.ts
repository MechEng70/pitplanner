// "Export my data": every row of every table as JSON (TECH-DESIGN section 5). It reads whatever tables the
// file has, so it works on a database stuck at an old version after a failed migration, and it includes the
// quarantined values (kv rows `quarantine:...`). T-036 adds the Gear row and importing this file.

import type { Db, SqlValue } from './db.ts';
import { userVersion } from './migrate.ts';

type Row = Record<string, SqlValue>;

export interface ExportDump {
  format: 'pitplanner-export';
  formatVersion: 1;
  exportedAt: number;
  appVersion: string;
  schemaVersion: number;
  tables: Record<string, Row[]>;
  /** Tables that could not be read, with the reason. The rest of the dump is still good. */
  errors: Record<string, string>;
}

/** Table names come from the database itself; anything that is not a plain identifier is left out. */
const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function exportDump(db: Db, now: number, appVersion: string): ExportDump {
  const dump: ExportDump = {
    format: 'pitplanner-export',
    formatVersion: 1,
    exportedAt: now,
    appVersion,
    schemaVersion: userVersion(db),
    tables: {},
    errors: {},
  };
  const names = db
    .all<{ name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .map(r => r.name)
    .filter(name => PLAIN_NAME.test(name));
  for (const name of names) {
    try {
      dump.tables[name] = db.all<Row>(`SELECT * FROM "${name}"`);
    } catch (e) {
      dump.errors[name] = e instanceof Error ? e.message : String(e);
    }
  }
  return dump;
}

/** pitplanner-export-2026-11-12-2205.json (UTC, so the name never depends on the phone's time zone). */
export function exportFileName(now: number): string {
  const [date, time] = new Date(now).toISOString().split('T') as [string, string];
  return `pitplanner-export-${date}-${time.slice(0, 5).replace(':', '')}.json`;
}
