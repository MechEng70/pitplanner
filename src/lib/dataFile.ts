// The data file (T-036): the user's own data as one JSON file, to move it to another phone or keep a copy,
// and the reader that checks such a file before anything is restored. Pure: the rules, the time and the
// text are passed in; no storage, no clock, no platform.
//
// What is in it (SPEC section 9 names): gear (cookers), units, rates, totalHours, rateLocks, history (every
// saved cook with its items, discarded ones included, notes and lateness), flags (the one-time hints).
// What is not, and why:
// - the running cook: its alarms, times and taps belong to the phone it runs on; a restore never starts or
//   replaces a cook (src/db/restore.ts refuses while one runs).
// - the plan draft: a menu for one serve date; Share plan (.pitplan) is how a plan moves.
// - where the user was (`ui`), the event log, the last update check, the 0.2.0 import marker
//   (`legacy_import`), the dev flags: facts about this install, not the user's data.
// - quarantined values: raw text the app could not read; "Export my data" (src/db/export.ts) keeps them for
//   Jason, and a restore cannot use them.
//
// The reader also takes the "Export my data" dump (format `pitplanner-export`, schema version 1), so a file
// shared from the migration error screen can be restored too. Either way the file is untrusted: a size cap,
// a format and version check, every field checked by type and range, unknown fields ignored, never a path
// or URI taken from it. Whatever is left out is listed with the reason.

import type { CookLog, Cookers, GriddleProfile, OvenProfile, SmokerProfile } from '../../engine/types.ts';
import type { Rules } from '../../engine/rules.ts';
import { isObj, isStr, parseJson, type Obj } from '../db/repos/json.ts';
import type { Flags } from '../db/repos/settings.ts';
import type { Units } from './format.ts';
import type { CookRecord } from './history.ts';
import { HOURS_MAX, HOURS_MIN } from './timing.ts';

export const DATA_FORMAT = 'pitplanner-data';
export const DATA_VERSION = 1;
/** The "Export my data" dump this reader also takes (src/db/export.ts). */
const DUMP_FORMAT = 'pitplanner-export';
const DUMP_SCHEMA = 1;

/** Characters, checked before the text is parsed. A cook with a few foods is about 1 KB. */
export const MAX_CHARS = 2_000_000;
/** Cooks kept from one file: the newest. */
export const MAX_COOKS = 1000;
/** Items in one cook: the most a shared plan can hold (src/lib/sharedPlan.ts). */
export const MAX_ITEMS = 20;
/** Notes longer than this are cut, not dropped. */
export const MAX_NOTES = 5000;
const MAX_NAME = 100;
const MAX_ID = 64;
const MAX_OPTIONS = 20;
const MAX_PRESETS = 50;
const ID = /^[A-Za-z0-9_.:-]+$/;
/** No cook is dated before this. */
const EARLIEST = Date.UTC(2000, 0, 1);
const YEAR = 366 * 86_400_000;
const WEEK_MIN = 7 * 24 * 60;

/** What the app holds that goes in the file (AppState fields). */
export interface DataInput {
  gear: Cookers;
  units: Units;
  rates: Record<string, number>;
  totalHours: Record<string, number>;
  rateLocks: Record<string, boolean>;
  records: CookRecord[];
  flags: Flags;
}

export interface DataFile {
  format: typeof DATA_FORMAT;
  version: typeof DATA_VERSION;
  exportedAt: number;
  appVersion: string;
  units: Units;
  gear: Cookers;
  rates: Record<string, number>;
  totalHours: Record<string, number>;
  rateLocks: Record<string, boolean>;
  history: CookRecord[];
  flags: Flags;
}

export function buildDataFile(d: DataInput, now: number, appVersion: string): string {
  const file: DataFile = {
    format: DATA_FORMAT,
    version: DATA_VERSION,
    exportedAt: now,
    appVersion,
    units: d.units,
    gear: d.gear,
    rates: d.rates,
    totalHours: d.totalHours,
    rateLocks: d.rateLocks,
    history: d.records,
    flags: d.flags,
  };
  return JSON.stringify(file);
}

/** pitplanner-data-2026-11-16-0905.json (UTC, as the export dump's name). */
export function dataFileName(now: number): string {
  const [date, time] = new Date(now).toISOString().split('T') as [string, string];
  return `pitplanner-data-${date}-${time.slice(0, 5).replace(':', '')}.json`;
}

/** What a restore writes. Null units or flags, or no cookers: the phone keeps its own. */
export interface RestoreData {
  gear: Cookers;
  units: Units | null;
  rates: Record<string, number>;
  totalHours: Record<string, number>;
  rateLocks: Record<string, boolean>;
  history: CookRecord[];
  flags: Flags | null;
}

export type DataPart = 'units' | 'gear' | 'rates' | 'totalHours' | 'rateLocks' | 'history' | 'flags';
export type DropReason =
  | 'bad value'
  | 'out of range'
  | 'unknown kind'
  | 'unknown food'
  | 'unknown method'
  | 'duplicate'
  | 'too many'
  | 'no items left'
  | 'notes cut';
/** One thing left out (or, for notes, cut). `key`: a cooker kind, a food id, a cook id, "<cook id> item <n>". */
export interface Dropped {
  part: DataPart;
  key: string;
  reason: DropReason;
}

export type FileProblem = 'too big' | 'not json' | 'not ours' | 'newer' | 'damaged' | 'nothing to restore';

export type DataCheck =
  | {
      ok: true;
      /** `data`: a file from Export; `dump`: "Export my data". */
      from: 'data' | 'dump';
      exportedAt: number | null;
      appVersion: string;
      data: RestoreData;
      /** What would be restored: cookers, foods with a saved rate, total hours or lock, cooks. */
      counts: { cookers: number; rates: number; cooks: number };
      dropped: Dropped[];
    }
  | { ok: false; problem: FileProblem };

// ---- checks -------------------------------------------------------------------------------------------

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const shortStr = (v: unknown, max = MAX_NAME): v is string => isStr(v) && v.length > 0 && v.length <= max;
const isId = (v: unknown): v is string => shortStr(v, MAX_ID) && ID.test(v);
const isNullNum = (v: unknown): v is number | null => v === null || num(v);

/** A field check: 'bad value' when a field has the wrong type, 'out of range' when a number is off. */
type Verdict = 'ok' | 'bad value' | 'out of range';
function judge(types: boolean, ranges: () => boolean): Verdict {
  if (!types) return 'bad value';
  return ranges() ? 'ok' : 'out of range';
}

const TEMP: [number, number] = [50, 1500];
const SMOKER_TYPES: readonly string[] = ['pellet', 'kamado', 'drum', 'gravity', 'offset', 'electric', 'other'];

function readSmoker(p: Obj): [Verdict, SmokerProfile | null] {
  const presets = p.tempPresetsF;
  const types =
    shortStr(p.id) &&
    shortStr(p.name) &&
    SMOKER_TYPES.includes(p.type as string) &&
    isNullNum(p.tempStepF) &&
    (presets === undefined || (Array.isArray(presets) && presets.every(num))) &&
    num(p.minTempF) &&
    num(p.maxTempF) &&
    isNullNum(p.hopperLb) &&
    isNullNum(p.mainGrateSqIn) &&
    isNullNum(p.upperRackSqIn) &&
    num(p.pelletLbPerHrLow) &&
    num(p.pelletLbPerHrHigh) &&
    num(p.preheatMin);
  const v = judge(types, () => {
    const min = p.minTempF as number;
    const max = p.maxTempF as number;
    const opt = (x: unknown, hi: number) => x === null || inRange(x as number, 0, hi);
    return (
      inRange(min, ...TEMP) &&
      inRange(max, ...TEMP) &&
      min <= max &&
      (p.tempStepF === null || inRange(p.tempStepF as number, 1, 100)) &&
      (presets === undefined ||
        ((presets as number[]).length <= MAX_PRESETS && (presets as number[]).every(t => inRange(t, ...TEMP)))) &&
      opt(p.hopperLb, 500) &&
      opt(p.mainGrateSqIn, 20_000) &&
      opt(p.upperRackSqIn, 20_000) &&
      inRange(p.pelletLbPerHrLow as number, 0, 50) &&
      inRange(p.pelletLbPerHrHigh as number, 0, 50) &&
      inRange(p.preheatMin as number, 0, 600)
    );
  });
  if (v !== 'ok') return [v, null];
  const out: SmokerProfile = {
    id: p.id as string,
    name: p.name as string,
    type: p.type as SmokerProfile['type'],
    tempStepF: p.tempStepF as number | null,
    minTempF: p.minTempF as number,
    maxTempF: p.maxTempF as number,
    hopperLb: p.hopperLb as number | null,
    mainGrateSqIn: p.mainGrateSqIn as number | null,
    upperRackSqIn: p.upperRackSqIn as number | null,
    pelletLbPerHrLow: p.pelletLbPerHrLow as number,
    pelletLbPerHrHigh: p.pelletLbPerHrHigh as number,
    preheatMin: p.preheatMin as number,
  };
  if (presets !== undefined) out.tempPresetsF = [...(presets as number[])];
  return ['ok', out];
}

function readGriddle(p: Obj): [Verdict, GriddleProfile | null] {
  const v = judge(
    shortStr(p.id) &&
      shortStr(p.name) &&
      num(p.sizeIn) &&
      num(p.burners) &&
      typeof p.hasDome === 'boolean' &&
      num(p.preheatMin),
    () =>
      inRange(p.sizeIn as number, 1, 200) &&
      inRange(p.burners as number, 1, 20) &&
      inRange(p.preheatMin as number, 0, 600),
  );
  if (v !== 'ok') return [v, null];
  return [
    'ok',
    {
      id: p.id as string,
      name: p.name as string,
      sizeIn: p.sizeIn as number,
      burners: p.burners as number,
      hasDome: p.hasDome as boolean,
      preheatMin: p.preheatMin as number,
    },
  ];
}

function readOven(p: Obj): [Verdict, OvenProfile | null] {
  const v = judge(
    shortStr(p.id) &&
      num(p.lowestTempF) &&
      ['oven', 'cooler', 'ask'].includes(p.holdIn as string) &&
      (p.warmingDrawer === undefined || typeof p.warmingDrawer === 'boolean'),
    () => inRange(p.lowestTempF as number, ...TEMP),
  );
  if (v !== 'ok') return [v, null];
  const out: OvenProfile = {
    id: p.id as string,
    lowestTempF: p.lowestTempF as number,
    holdIn: p.holdIn as OvenProfile['holdIn'],
  };
  if (p.warmingDrawer !== undefined) out.warmingDrawer = p.warmingDrawer as boolean;
  return ['ok', out];
}

const COOKER_READERS = { smoker: readSmoker, griddle: readGriddle, oven: readOven } as const;
type Kind = keyof typeof COOKER_READERS;
const KINDS: readonly string[] = ['smoker', 'griddle', 'oven'];
const isKind = (k: string): k is Kind => KINDS.includes(k);

/** Reads one file's parts, noting each thing left out. */
class Reader {
  dropped: Dropped[] = [];
  constructor(
    private rules: Rules,
    private now: number,
  ) {}

  drop(part: DataPart, key: string, reason: DropReason) {
    this.dropped.push({ part, key, reason });
  }

  private food(id: string) {
    return this.rules.foods.find(f => f.id === id);
  }

  units(raw: unknown): Units | null {
    if (raw === undefined) return null;
    const ok = isObj(raw) && (raw.temp === 'F' || raw.temp === 'C') && (raw.weight === 'lb' || raw.weight === 'kg');
    if (!ok) {
      this.drop('units', 'units', 'bad value');
      return null;
    }
    return { temp: raw.temp as Units['temp'], weight: raw.weight as Units['weight'] };
  }

  flags(raw: unknown): Flags | null {
    if (raw === undefined) return null;
    if (!isObj(raw)) {
      this.drop('flags', 'flags', 'bad value');
      return null;
    }
    const out: Flags = {};
    if (raw.supportShown === true) out.supportShown = true;
    if (raw.rateHintShown === true) out.rateHintShown = true;
    return out;
  }

  gear(raw: unknown): Cookers {
    const out: Cookers = {};
    if (raw === undefined) return out;
    if (!isObj(raw)) {
      this.drop('gear', 'gear', 'bad value');
      return out;
    }
    for (const [kind, p] of Object.entries(raw)) {
      if (!isKind(kind)) {
        this.drop('gear', kind, 'unknown kind');
        continue;
      }
      const [verdict, profile] = isObj(p) ? COOKER_READERS[kind](p) : (['bad value', null] as const);
      if (profile) Object.assign(out, { [kind]: profile });
      else this.drop('gear', kind, verdict === 'ok' ? 'bad value' : verdict);
    }
    return out;
  }

  /**
   * A map by food id: `read` gives the value to keep, a reason to drop it, or null to skip it quietly. Only
   * foods in the rules are kept, so no key can reach an object's prototype.
   */
  private byFood<T>(part: DataPart, raw: unknown, read: (v: unknown) => { value: T } | DropReason | null) {
    const out: Record<string, T> = {};
    if (raw === undefined) return out;
    if (!isObj(raw)) {
      this.drop(part, part, 'bad value');
      return out;
    }
    for (const [food, v] of Object.entries(raw)) {
      if (!this.food(food)) {
        this.drop(part, food, 'unknown food');
        continue;
      }
      const got = read(v);
      if (typeof got === 'string') this.drop(part, food, got);
      else if (got) out[food] = got.value;
    }
    return out;
  }

  rates(raw: unknown): Record<string, number> {
    const [lo, hi] = this.rules.learning.rateLimits;
    return this.byFood('rates', raw, v => (!num(v) ? 'bad value' : inRange(v, lo, hi) ? { value: v } : 'out of range'));
  }

  totalHours(raw: unknown): Record<string, number> {
    return this.byFood('totalHours', raw, v =>
      !num(v) ? 'bad value' : inRange(v, HOURS_MIN, HOURS_MAX) ? { value: v } : 'out of range',
    );
  }

  rateLocks(raw: unknown): Record<string, boolean> {
    // false is the same as no lock: nothing to keep, nothing to report.
    return this.byFood('rateLocks', raw, v => (v === true ? { value: true } : v === false ? null : 'bad value'));
  }

  /**
   * One food of a saved cook. A food the app does not know (from a newer app) is kept as it is, method and
   * all (Jason, 2026-11-16): history shows it and the rates never read it. A known food with a method it does
   * not have is left out.
   */
  private item(raw: unknown): [Verdict | 'unknown method', CookRecord['items'][number] | null] {
    if (!isObj(raw) || !isObj(raw.log)) return ['bad value', null];
    const l = raw.log;
    const options = l.options;
    const okOptions =
      options === undefined ||
      (isObj(options) &&
        Object.keys(options).length <= MAX_OPTIONS &&
        Object.entries(options).every(([k, v]) => shortStr(k, MAX_ID) && shortStr(v, MAX_ID)));
    const types =
      shortStr(raw.name) &&
      num(raw.plannedMin) &&
      num(raw.actualMin) &&
      shortStr(l.foodId, MAX_ID) &&
      shortStr(l.methodId, MAX_ID) &&
      shortStr(l.smokerId) &&
      num(l.quantity) &&
      num(l.pitTempF) &&
      num(l.minutesOnHeat) &&
      okOptions &&
      (l.discarded === undefined || typeof l.discarded === 'boolean');
    const v = judge(
      types,
      () =>
        inRange(raw.plannedMin as number, 0, WEEK_MIN) &&
        inRange(raw.actualMin as number, 0, WEEK_MIN) &&
        (l.quantity as number) > 0 &&
        (l.quantity as number) <= 1000 &&
        inRange(l.pitTempF as number, ...TEMP) &&
        inRange(l.minutesOnHeat as number, 0, WEEK_MIN),
    );
    if (v !== 'ok') return [v, null];
    const food = this.food(l.foodId as string);
    if (food && !food.methods.some(m => m.id === l.methodId)) return ['unknown method', null];
    const log: CookLog = {
      foodId: l.foodId as string,
      methodId: l.methodId as string,
      smokerId: l.smokerId as string,
      quantity: l.quantity as number,
      pitTempF: l.pitTempF as number,
      minutesOnHeat: l.minutesOnHeat as number,
    };
    // fromEntries defines own keys, so an option named __proto__ stays a plain key.
    if (options !== undefined)
      log.options = Object.fromEntries(Object.entries(options as Obj)) as Record<string, string>;
    if (l.discarded === true) log.discarded = true;
    return [
      'ok',
      { name: raw.name as string, plannedMin: raw.plannedMin as number, actualMin: raw.actualMin as number, log },
    ];
  }

  history(raw: unknown): CookRecord[] {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      this.drop('history', 'history', 'bad value');
      return [];
    }
    // The newest cooks are last (saved in order).
    const extra = Math.max(0, raw.length - MAX_COOKS);
    if (extra > 0) this.drop('history', `${extra} cooks`, 'too many');
    const out: CookRecord[] = [];
    const seen = new Set<string>();
    raw.slice(extra).forEach((r: unknown, i) => {
      const at = `cook ${extra + i + 1}`;
      if (!isObj(r) || !isId(r.id)) return this.drop('history', at, 'bad value');
      const id = r.id;
      if (seen.has(id)) return this.drop('history', id, 'duplicate');
      const late = r.lateMin;
      const types =
        num(r.date) &&
        num(r.pitTempF) &&
        (r.notes === undefined || isStr(r.notes)) &&
        (late === undefined || late === null || num(late)) &&
        Array.isArray(r.items);
      const v = judge(
        types,
        () =>
          inRange(r.date as number, EARLIEST, this.now + YEAR) &&
          inRange(r.pitTempF as number, ...TEMP) &&
          (!num(late) || inRange(late, -WEEK_MIN, WEEK_MIN)),
      );
      if (v !== 'ok') return this.drop('history', id, v);
      const rawItems = r.items as unknown[];
      const items: CookRecord['items'] = [];
      rawItems.slice(0, MAX_ITEMS).forEach((it, n) => {
        const [verdict, item] = this.item(it);
        if (item) items.push(item);
        else this.drop('history', `${id} item ${n + 1}`, verdict === 'ok' ? 'bad value' : verdict);
      });
      if (rawItems.length > MAX_ITEMS) this.drop('history', `${id} ${rawItems.length - MAX_ITEMS} items`, 'too many');
      if (items.length === 0) return this.drop('history', id, 'no items left');
      let notes = isStr(r.notes) ? r.notes : '';
      if (notes.length > MAX_NOTES) {
        notes = notes.slice(0, MAX_NOTES);
        this.drop('history', id, 'notes cut');
      }
      const record: CookRecord = { id, date: r.date as number, notes, pitTempF: r.pitTempF as number, items };
      if (late !== undefined) record.lateMin = late as number | null;
      seen.add(id);
      out.push(record);
    });
    return out;
  }
}

// ---- the "Export my data" dump, turned into the data file's shape -------------------------------------

const rowsOf = (tables: Obj, name: string): Obj[] => {
  const rows = tables[name];
  return Array.isArray(rows) ? rows.filter(isObj) : [];
};

/** The dump's tables as the data file's fields, raw: the same checks run on them after. */
function fromDump(tables: Obj): Obj {
  const kv = new Map(rowsOf(tables, 'kv').map(r => [r.key, r.value]));
  const json = (v: unknown) => (isStr(v) ? parseJson(v) : undefined);

  // The first cooker of each kind by position, as the app loads them; a profile that is not JSON is bad.
  // Maps and entry lists become objects through fromEntries, which defines own keys: a name read from a
  // row never reaches a prototype.
  const gear = new Map<string, unknown>();
  const cookers = rowsOf(tables, 'cookers').sort((a, b) => Number(a.position) - Number(b.position));
  for (const row of cookers) {
    if (isStr(row.kind) && !gear.has(row.kind)) gear.set(row.kind, json(row.profile) ?? null);
  }

  const rates: [string, unknown][] = [];
  const totalHours: [string, unknown][] = [];
  const rateLocks: [string, unknown][] = [];
  for (const row of rowsOf(tables, 'rate_overrides')) {
    if (!isStr(row.food_id)) continue;
    if (row.hr_per_lb != null) rates.push([row.food_id, row.hr_per_lb]);
    if (row.total_hours != null) totalHours.push([row.food_id, row.total_hours]);
    if (row.locked === 1) rateLocks.push([row.food_id, true]);
  }

  const items = rowsOf(tables, 'cook_history_items').sort((a, b) => Number(a.position) - Number(b.position));
  const history = rowsOf(tables, 'cook_history').map(c => {
    const record: Obj = { id: c.id, date: c.served_at, pitTempF: c.pit_temp_f, notes: c.notes };
    if (c.ended_early === 1) record.lateMin = null;
    else if (c.late_min != null) record.lateMin = c.late_min;
    record.items = items
      .filter(i => i.cook_id === c.id)
      .map(i => {
        const log: Obj = {
          foodId: i.food_id,
          methodId: i.method_id,
          smokerId: i.smoker_id,
          quantity: i.quantity,
          pitTempF: i.pit_temp_f,
          minutesOnHeat: i.minutes_on_heat,
        };
        // As the app reads them: options that are not a map of strings are none.
        const options = json(i.options);
        if (isObj(options) && Object.values(options).every(isStr)) log.options = options;
        if (i.discarded === 1) log.discarded = true;
        return { name: i.name, plannedMin: i.planned_min, actualMin: i.actual_min, log };
      });
    return record;
  });

  return {
    units: json(kv.get('units')),
    flags: json(kv.get('flags')),
    gear: Object.fromEntries(gear),
    rates: Object.fromEntries(rates),
    totalHours: Object.fromEntries(totalHours),
    rateLocks: Object.fromEntries(rateLocks),
    history,
  };
}

// ---- the reader ---------------------------------------------------------------------------------------

/** Check a file someone picked. Never throws; nothing in it is trusted. */
export function readDataFile(rules: Rules, text: string, now: number): DataCheck {
  if (text.length > MAX_CHARS) return { ok: false, problem: 'too big' };
  const parsed = parseJson(text);
  if (parsed === undefined) return { ok: false, problem: 'not json' };
  if (!isObj(parsed)) return { ok: false, problem: 'not ours' };

  let body: Obj;
  let from: 'data' | 'dump';
  if (parsed.format === DATA_FORMAT) {
    const v = parsed.version;
    if (!Number.isInteger(v) || (v as number) < 1) return { ok: false, problem: 'damaged' };
    if (v !== DATA_VERSION) return { ok: false, problem: 'newer' };
    body = parsed;
    from = 'data';
  } else if (parsed.format === DUMP_FORMAT) {
    const v = parsed.formatVersion;
    const schema = parsed.schemaVersion;
    if (!Number.isInteger(v) || (v as number) < 1 || !Number.isInteger(schema))
      return { ok: false, problem: 'damaged' };
    if (v !== 1 || (schema as number) > DUMP_SCHEMA) return { ok: false, problem: 'newer' };
    if (schema !== DUMP_SCHEMA || !isObj(parsed.tables)) return { ok: false, problem: 'damaged' };
    body = fromDump(parsed.tables);
    from = 'dump';
  } else {
    return { ok: false, problem: 'not ours' };
  }

  const r = new Reader(rules, now);
  const data: RestoreData = {
    units: r.units(body.units),
    gear: r.gear(body.gear),
    rates: r.rates(body.rates),
    totalHours: r.totalHours(body.totalHours),
    rateLocks: r.rateLocks(body.rateLocks),
    history: r.history(body.history),
    flags: r.flags(body.flags),
  };
  const foods = new Set([...Object.keys(data.rates), ...Object.keys(data.totalHours), ...Object.keys(data.rateLocks)]);
  const counts = { cookers: Object.keys(data.gear).length, rates: foods.size, cooks: data.history.length };
  if (counts.cookers + counts.rates + counts.cooks === 0) return { ok: false, problem: 'nothing to restore' };
  return {
    ok: true,
    from,
    exportedAt: num(parsed.exportedAt) ? parsed.exportedAt : null,
    appVersion: shortStr(parsed.appVersion, 32) ? parsed.appVersion : '',
    data,
    counts,
    dropped: r.dropped,
  };
}
