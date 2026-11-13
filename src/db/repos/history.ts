// Cook history: cook_history + cook_history_items, assembled into the CookRecord the screens and
// src/lib/historyView.ts use. Records come back in the order they were saved (as history.json was).

import type { CookLog } from '../../../engine/types.ts';
import type { CookRecord } from '../../lib/history.ts';
import type { Db } from '../db.ts';
import { isStrMap, parseJson } from './json.ts';
import { quarantine } from './quarantine.ts';

interface CookRow {
  id: string;
  served_at: number;
  pit_temp_f: number;
  late_min: number | null;
  ended_early: number;
  notes: string;
}
interface ItemRow {
  cook_id: string;
  name: string;
  food_id: string;
  method_id: string;
  smoker_id: string;
  quantity: number;
  pit_temp_f: number;
  minutes_on_heat: number;
  planned_min: number;
  actual_min: number;
  options: string | null;
  discarded: number;
}
const ITEM_COLUMNS =
  'i.cook_id, i.name, i.food_id, i.method_id, i.smoker_id, i.quantity, i.pit_temp_f, i.minutes_on_heat,' +
  ' i.planned_min, i.actual_min, i.options, i.discarded';
const LIST_ITEMS = `SELECT ${ITEM_COLUMNS} FROM cook_history_items i ORDER BY i.cook_id, i.position`;
const LIST_LOGS =
  `SELECT ${ITEM_COLUMNS} FROM cook_history_items i JOIN cook_history c ON c.id = i.cook_id` +
  ' WHERE i.discarded = 0 ORDER BY c.rowid, i.position';

function toLog(r: ItemRow): CookLog {
  const log: CookLog = {
    foodId: r.food_id,
    methodId: r.method_id,
    smokerId: r.smoker_id,
    quantity: r.quantity,
    pitTempF: r.pit_temp_f,
    minutesOnHeat: r.minutes_on_heat,
  };
  // Corrupt options read as none; the cook still counts.
  const options = parseJson(r.options);
  if (isStrMap(options)) log.options = options;
  if (r.discarded === 1) log.discarded = true;
  return log;
}

export function historyRepo(db: Db) {
  /** Item options that cannot be read are quarantined before their rows are replaced or removed. */
  const keepCorruptOptions = (cookId: string, now: number) => {
    const rows = db.all<{ position: number; options: string }>(
      'SELECT position, options FROM cook_history_items WHERE cook_id = ? AND options IS NOT NULL ORDER BY position',
      [cookId],
    );
    for (const row of rows) {
      if (!isStrMap(parseJson(row.options))) {
        quarantine(db, `cook_history_items:${cookId}:${row.position}`, row.options, now);
      }
    }
  };
  const insertItems = (r: CookRecord) => {
    r.items.forEach((item, position) => {
      const l = item.log;
      db.run(
        'INSERT INTO cook_history_items (cook_id, position, name, food_id, method_id, smoker_id, quantity,' +
          ' pit_temp_f, minutes_on_heat, planned_min, actual_min, options, discarded)' +
          ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          r.id,
          position,
          item.name,
          l.foodId,
          l.methodId,
          l.smokerId,
          l.quantity,
          l.pitTempF,
          l.minutesOnHeat,
          item.plannedMin,
          item.actualMin,
          l.options ? JSON.stringify(l.options) : null,
          l.discarded ? 1 : 0,
        ],
      );
    });
  };
  return {
    list(): CookRecord[] {
      const cooks = db.all<CookRow>(
        'SELECT id, served_at, pit_temp_f, late_min, ended_early, notes FROM cook_history ORDER BY rowid',
      );
      const byCook = new Map<string, CookRecord['items']>();
      for (const row of db.all<ItemRow>(LIST_ITEMS)) {
        const list = byCook.get(row.cook_id) ?? [];
        list.push({ name: row.name, plannedMin: row.planned_min, actualMin: row.actual_min, log: toLog(row) });
        byCook.set(row.cook_id, list);
      }
      return cooks.map(c => {
        const record: CookRecord = {
          id: c.id,
          date: c.served_at,
          notes: c.notes,
          pitTempF: c.pit_temp_f,
          items: byCook.get(c.id) ?? [],
        };
        // lateMin: a number, null (ended before serve), or absent (saved before lateness was kept).
        if (c.ended_early === 1) record.lateMin = null;
        else if (c.late_min !== null) record.lateMin = c.late_min;
        return record;
      });
    },
    /** The logs the engine learns from: the same list, in the same order, as `logsOf(list())`. */
    logs(): CookLog[] {
      return db.all<ItemRow>(LIST_LOGS).map(toLog);
    },
    /** Add a record, or replace the one with the same id in place (it keeps its position in the list). */
    save(r: CookRecord, now: number): void {
      db.transaction(() => {
        keepCorruptOptions(r.id, now);
        const late = typeof r.lateMin === 'number' ? r.lateMin : null;
        const endedEarly = r.lateMin === null ? 1 : 0;
        const updated = db.run(
          'UPDATE cook_history SET served_at = ?, pit_temp_f = ?, late_min = ?, ended_early = ?, notes = ? WHERE id = ?',
          [r.date, r.pitTempF, late, endedEarly, r.notes, r.id],
        );
        if (updated.changes === 0) {
          db.run(
            'INSERT INTO cook_history (id, served_at, pit_temp_f, late_min, ended_early, notes, created_at)' +
              ' VALUES (?, ?, ?, ?, ?, ?, ?)',
            [r.id, r.date, r.pitTempF, late, endedEarly, r.notes, now],
          );
        } else {
          db.run('DELETE FROM cook_history_items WHERE cook_id = ?', [r.id]);
        }
        insertItems(r);
      });
    },
    remove(id: string, now: number): void {
      db.transaction(() => {
        keepCorruptOptions(id, now);
        db.run('DELETE FROM cook_history WHERE id = ?', [id]); // items go by ON DELETE CASCADE
      });
    },
  };
}
export type HistoryRepo = ReturnType<typeof historyRepo>;
