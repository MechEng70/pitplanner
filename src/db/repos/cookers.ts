// cookers: the user's gear, one row per cooker. The app has at most one of each kind today (engine
// `Cookers`); the table already allows more. A row whose profile is corrupt is skipped.

import type { Cookers, GriddleProfile, OvenProfile, SmokerProfile } from '../../../engine/types.ts';
import type { Db } from '../db.ts';
import { isNum, isNumOrNull, isObj, isStr, opt, parseJson } from './json.ts';
import { quarantine } from './quarantine.ts';

const SMOKER_TYPES = ['pellet', 'kamado', 'drum', 'gravity', 'offset', 'electric', 'other'];

function isSmoker(p: unknown): p is SmokerProfile {
  return (
    isObj(p) &&
    isStr(p.id) &&
    isStr(p.name) &&
    SMOKER_TYPES.includes(p.type as string) &&
    isNumOrNull(p.tempStepF) &&
    opt(p.tempPresetsF, v => Array.isArray(v) && v.every(isNum)) &&
    isNum(p.minTempF) &&
    isNum(p.maxTempF) &&
    isNumOrNull(p.hopperLb) &&
    isNumOrNull(p.mainGrateSqIn) &&
    isNumOrNull(p.upperRackSqIn) &&
    isNum(p.pelletLbPerHrLow) &&
    isNum(p.pelletLbPerHrHigh) &&
    isNum(p.preheatMin)
  );
}
function isGriddle(p: unknown): p is GriddleProfile {
  return (
    isObj(p) &&
    isStr(p.id) &&
    isStr(p.name) &&
    isNum(p.sizeIn) &&
    isNum(p.burners) &&
    typeof p.hasDome === 'boolean' &&
    isNum(p.preheatMin)
  );
}
function isOven(p: unknown): p is OvenProfile {
  return (
    isObj(p) &&
    isStr(p.id) &&
    isNum(p.lowestTempF) &&
    ['oven', 'cooler', 'ask'].includes(p.holdIn as string) &&
    opt(p.warmingDrawer, v => typeof v === 'boolean')
  );
}

const KINDS = ['smoker', 'griddle', 'oven'] as const;
const readable = (kind: string, p: unknown) =>
  (kind === 'smoker' && isSmoker(p)) || (kind === 'griddle' && isGriddle(p)) || (kind === 'oven' && isOven(p));

export function cookersRepo(db: Db) {
  return {
    /** The first readable cooker of each kind, by position. */
    load(): Cookers {
      const rows = db.all<{ kind: string; profile: string }>('SELECT kind, profile FROM cookers ORDER BY position, id');
      const out: Cookers = {};
      for (const row of rows) {
        const p = parseJson(row.profile);
        if (row.kind === 'smoker' && !out.smoker && isSmoker(p)) out.smoker = p;
        else if (row.kind === 'griddle' && !out.griddle && isGriddle(p)) out.griddle = p;
        else if (row.kind === 'oven' && !out.oven && isOven(p)) out.oven = p;
      }
      return out;
    },
    /** Rows in the table, readable or not: 0 means gear was never saved (first run). */
    count(): number {
      return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM cookers')?.n ?? 0;
    },
    /** Replace the whole set. A row that could not be read is quarantined before it goes. */
    save(cookers: Cookers, now: number): void {
      db.transaction(() => {
        for (const row of db.all<{ id: string; kind: string; profile: string }>(
          'SELECT id, kind, profile FROM cookers',
        )) {
          if (!readable(row.kind, parseJson(row.profile))) quarantine(db, `cookers:${row.id}`, row.profile, now);
        }
        db.run('DELETE FROM cookers');
        KINDS.forEach((kind, position) => {
          const p = cookers[kind];
          if (!p) return;
          // The kind is part of the key so a smoker and a griddle can never collide on a profile id.
          db.run('INSERT INTO cookers (id, kind, profile, position, updated_at) VALUES (?, ?, ?, ?, ?)', [
            `${kind}:${p.id}`,
            kind,
            JSON.stringify(p),
            position,
            now,
          ]);
        });
      });
    },
  };
}
export type CookersRepo = ReturnType<typeof cookersRepo>;
