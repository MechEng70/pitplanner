// rate_overrides: Cook rates saved by the user, per food: hr/lb at 225F, total hours, and the lock that
// stops a saved rate blending with logged cooks. A row with nothing left in it is deleted.

import type { Db } from '../db.ts';
import { quarantine } from './quarantine.ts';

export interface SavedRates {
  rates: Record<string, number>;
  totalHours: Record<string, number>;
  rateLocks: Record<string, boolean>;
}

type Column = 'hr_per_lb' | 'total_hours' | 'locked';
type Row = { food_id: string; hr_per_lb: unknown; total_hours: unknown; locked: unknown };
const usable = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** A stored value the app cannot use: a rate that is not a positive number, a lock that is not 0 or 1. */
const unreadable = (column: Column, v: unknown) =>
  column === 'locked' ? v !== 0 && v !== 1 : v !== null && !usable(v);
const upsert = (column: Column) =>
  `INSERT INTO rate_overrides (food_id, ${column}, updated_at) VALUES (?, ?, ?)` +
  ` ON CONFLICT(food_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at`;
// Fixed statements: the column names are the three literals here, never input.
const SQL: Record<Column, string> = {
  hr_per_lb: upsert('hr_per_lb'),
  total_hours: upsert('total_hours'),
  locked: upsert('locked'),
};

export function ratesRepo(db: Db) {
  const put = (column: Column, foodId: string, value: number | null, now: number) => {
    db.transaction(() => {
      const old = db.get<Row>('SELECT food_id, hr_per_lb, total_hours, locked FROM rate_overrides WHERE food_id = ?', [
        foodId,
      ]);
      // The whole row is kept, so the export shows what the unreadable value sat beside.
      if (old && unreadable(column, old[column])) quarantine(db, `rate_overrides:${foodId}`, JSON.stringify(old), now);
      db.run(SQL[column], [foodId, value, now]);
      db.run('DELETE FROM rate_overrides WHERE hr_per_lb IS NULL AND total_hours IS NULL AND locked = 0');
    });
  };
  return {
    load(): SavedRates {
      const out: SavedRates = { rates: {}, totalHours: {}, rateLocks: {} };
      const rows = db.all<Row>('SELECT food_id, hr_per_lb, total_hours, locked FROM rate_overrides ORDER BY food_id');
      for (const r of rows) {
        if (usable(r.hr_per_lb)) out.rates[r.food_id] = r.hr_per_lb;
        if (usable(r.total_hours)) out.totalHours[r.food_id] = r.total_hours;
        if (r.locked === 1) out.rateLocks[r.food_id] = true;
      }
      return out;
    },
    /** null removes the saved value. */
    setRate: (foodId: string, hrPerLb: number | null, now: number) => put('hr_per_lb', foodId, hrPerLb, now),
    setTotalHours: (foodId: string, hours: number | null, now: number) => put('total_hours', foodId, hours, now),
    setLock: (foodId: string, locked: boolean, now: number) => put('locked', foodId, locked ? 1 : 0, now),
  };
}
export type RatesRepo = ReturnType<typeof ratesRepo>;
