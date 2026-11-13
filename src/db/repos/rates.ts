// rate_overrides: Cook rates saved by the user, per food: hr/lb at 225F, total hours, and the lock that
// stops a saved rate blending with logged cooks. A row with nothing left in it is deleted.

import type { Db } from '../db.ts';

export interface SavedRates {
  rates: Record<string, number>;
  totalHours: Record<string, number>;
  rateLocks: Record<string, boolean>;
}

const usable = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const upsert = (column: 'hr_per_lb' | 'total_hours' | 'locked') =>
  `INSERT INTO rate_overrides (food_id, ${column}, updated_at) VALUES (?, ?, ?)` +
  ` ON CONFLICT(food_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at`;
// Fixed statements: the column names are the three literals here, never input.
const SQL = { rate: upsert('hr_per_lb'), total: upsert('total_hours'), lock: upsert('locked') };

export function ratesRepo(db: Db) {
  const put = (sql: string, foodId: string, value: number | null, now: number) => {
    db.transaction(() => {
      db.run(sql, [foodId, value, now]);
      db.run('DELETE FROM rate_overrides WHERE hr_per_lb IS NULL AND total_hours IS NULL AND locked = 0');
    });
  };
  return {
    load(): SavedRates {
      const out: SavedRates = { rates: {}, totalHours: {}, rateLocks: {} };
      const rows = db.all<{ food_id: string; hr_per_lb: number | null; total_hours: number | null; locked: number }>(
        'SELECT food_id, hr_per_lb, total_hours, locked FROM rate_overrides ORDER BY food_id',
      );
      for (const r of rows) {
        if (usable(r.hr_per_lb)) out.rates[r.food_id] = r.hr_per_lb;
        if (usable(r.total_hours)) out.totalHours[r.food_id] = r.total_hours;
        if (r.locked === 1) out.rateLocks[r.food_id] = true;
      }
      return out;
    },
    /** null removes the saved value. */
    setRate: (foodId: string, hrPerLb: number | null, now: number) => put(SQL.rate, foodId, hrPerLb, now),
    setTotalHours: (foodId: string, hours: number | null, now: number) => put(SQL.total, foodId, hours, now),
    setLock: (foodId: string, locked: boolean, now: number) => put(SQL.lock, foodId, locked ? 1 : 0, now),
  };
}
export type RatesRepo = ReturnType<typeof ratesRepo>;
