// One-time import of the 0.2.0 (Capacitor) app's data into SQLite, on the first start of 0.3.0
// (TECH-DESIGN section 5). Everything that can be read is written in one transaction; whatever cannot is
// reported (the notice says so plainly) and its raw text is quarantined, so nothing is silently dropped.
// The old files are retired only when everything came along; otherwise they stay where they are.

import type { Cookers } from '../../engine/types.ts';
import { normalize } from '../lib/cook.ts';
import { parseDraft } from '../lib/draft.ts';
import type { CookRecord } from '../lib/history.ts';
import type { LegacyStore } from '../platform/types.ts';
import type { Db } from './db.ts';
import { looksLikeCook } from './repos/activeCook.ts';
import { KINDS, readable } from './repos/cookers.ts';
import { repos } from './repos/index.ts';
import { isNum, isObj, isStr, isStrMap, opt, parseJson } from './repos/json.ts';
import { quarantine } from './repos/quarantine.ts';
import { parseFlags, parseUnits, parseUpdate } from './repos/settings.ts';

export const IMPORT_KEY = 'legacy_import';

/** What the user would miss, in the notice's words. */
export type LostPart = 'cookers' | 'units' | 'plan' | 'rates' | 'running cook' | 'past cooks';

export interface ImportReport {
  /** none: no 0.2.0 data. done: all of it came along. partial: some did. fresh: there was data, none readable. */
  status: 'none' | 'done' | 'partial' | 'fresh';
  at: number;
  cookers: number;
  rates: number;
  cooks: number;
  plan: boolean;
  runningCook: boolean;
  lost: LostPart[];
  /** The user has closed the notice. */
  noticeSeen: boolean;
}

const LOST: readonly LostPart[] = ['cookers', 'units', 'plan', 'rates', 'running cook', 'past cooks'];

function parseReport(raw: unknown): ImportReport | null {
  if (!isObj(raw) || !['none', 'done', 'partial', 'fresh'].includes(raw.status as string)) return null;
  return {
    status: raw.status as ImportReport['status'],
    at: isNum(raw.at) ? raw.at : 0,
    cookers: isNum(raw.cookers) ? raw.cookers : 0,
    rates: isNum(raw.rates) ? raw.rates : 0,
    cooks: isNum(raw.cooks) ? raw.cooks : 0,
    plan: raw.plan === true,
    runningCook: raw.runningCook === true,
    lost: Array.isArray(raw.lost) ? LOST.filter(p => (raw.lost as unknown[]).includes(p)) : [],
    noticeSeen: raw.noticeSeen === true,
  };
}

/** The saved report, or null before the import has run. */
export function importReport(db: Db): ImportReport | null {
  try {
    return repos(db).kv.get(IMPORT_KEY, parseReport);
  } catch {
    return null;
  }
}

export function markNoticeSeen(db: Db, now: number): void {
  const report = importReport(db);
  if (report) repos(db).kv.set(IMPORT_KEY, { ...report, noticeSeen: true }, now);
}

function isRecord(v: unknown): v is CookRecord {
  if (!isObj(v) || !isStr(v.id) || !isNum(v.date) || !isNum(v.pitTempF) || !Array.isArray(v.items)) return false;
  if (!opt(v.notes, isStr) || !(v.lateMin === undefined || v.lateMin === null || isNum(v.lateMin))) return false;
  return v.items.every(
    (i: unknown) =>
      isObj(i) &&
      isStr(i.name) &&
      isNum(i.plannedMin) &&
      isNum(i.actualMin) &&
      isObj(i.log) &&
      isStr(i.log.foodId) &&
      isStr(i.log.methodId) &&
      isStr(i.log.smokerId) &&
      isNum(i.log.quantity) &&
      isNum(i.log.pitTempF) &&
      isNum(i.log.minutesOnHeat) &&
      opt(i.log.options, isStrMap) &&
      opt(i.log.discarded, d => typeof d === 'boolean'),
  );
}

/**
 * Run the import if it has not run yet, and return its report. Call after migrations and before the store
 * loads. Never throws: if the write itself fails, nothing is imported, the old files stay, and the report
 * (not saved, so the next start tries again) says the app starts fresh.
 */
export function importLegacy(db: Db, legacy: LegacyStore, now: number): ImportReport {
  const earlier = importReport(db);
  if (earlier) return earlier;
  const r = repos(db);
  const report: ImportReport = {
    status: 'none',
    at: now,
    cookers: 0,
    rates: 0,
    cooks: 0,
    plan: false,
    runningCook: false,
    lost: [],
    noticeSeen: false,
  };
  let prefs: Record<string, string>;
  let historyText: string | null;
  try {
    prefs = legacy.readCapacitorPrefs();
    historyText = legacy.readHistoryFile();
  } catch {
    return { ...report, status: 'fresh', lost: [...LOST] };
  }
  const hadData = Object.keys(prefs).length > 0 || historyText !== null;

  try {
    db.transaction(() => {
      const lose = (part: LostPart | null, key: string, raw: string) => {
        if (part && !report.lost.includes(part)) report.lost.push(part);
        quarantine(db, `legacy:${key}`, raw, now);
      };
      /** The parsed value of a key, `undefined` when the key is absent, `null` (and lost) when unreadable. */
      const read = <T>(
        key: string,
        part: LostPart | null,
        parse: (json: unknown) => T | null,
      ): T | null | undefined => {
        const raw = prefs[key];
        if (raw === undefined) return undefined;
        const json = parseJson(raw);
        const value = json === undefined ? null : parse(json);
        if (value === null) lose(part, key, raw);
        return value;
      };

      // gear: each cooker on its own, so one bad profile does not cost the others.
      const gear = read('gear', 'cookers', json => (isObj(json) ? json : null));
      if (gear) {
        const cookers: Cookers = {};
        let bad = false;
        for (const kind of KINDS) {
          const p = gear[kind];
          if (p === undefined) continue;
          if (readable(kind, p)) Object.assign(cookers, { [kind]: p });
          else bad = true;
        }
        if (bad) lose('cookers', 'gear', prefs.gear ?? '');
        report.cookers = Object.keys(cookers).length;
        if (report.cookers > 0) r.cookers.save(cookers, now);
      }

      const units = read('settings', 'units', parseUnits);
      if (units) r.settings.setUnits(units, now);

      const draft = read('draft', 'plan', parseDraft);
      if (draft) {
        r.settings.setDraft(draft, now);
        report.plan = draft.items.length > 0;
      }

      // rates, totalHours, rateLocks: three maps by food. A value of the wrong type costs only itself.
      const map = (key: string) => read(key, 'rates', json => (isObj(json) ? json : null));
      const usable = (v: unknown): v is number => isNum(v) && v > 0;
      const foods = new Set<string>();
      let badRate = false;
      for (const [food, v] of Object.entries(map('rates') ?? {})) {
        if (!usable(v)) badRate = true;
        else {
          r.rates.setRate(food, v, now);
          foods.add(food);
        }
      }
      for (const [food, v] of Object.entries(map('totalHours') ?? {})) {
        if (!usable(v)) badRate = true;
        else {
          r.rates.setTotalHours(food, v, now);
          foods.add(food);
        }
      }
      for (const [food, v] of Object.entries(map('rateLocks') ?? {})) {
        if (v === true) r.rates.setLock(food, true, now);
        else if (v !== false) badRate = true;
      }
      if (badRate) {
        for (const key of ['rates', 'totalHours', 'rateLocks'])
          if (prefs[key] !== undefined) lose('rates', key, prefs[key]);
      }
      report.rates = foods.size;

      // A cook still running is kept only if its serve time is ahead; a finished one is simply over.
      const cook = read('activeCook', 'running cook', json => (looksLikeCook(json) ? normalize(json) : null));
      if (cook && cook.plan.serveAt > now) {
        r.activeCook.save(cook, now);
        report.runningCook = true;
      }

      // Small things nobody would miss: imported when readable, quarantined when not, never reported.
      const flags = read('flags', null, parseFlags);
      if (flags) r.settings.setFlags(flags, now);
      const update = read('update', null, parseUpdate);
      if (update) r.settings.setUpdate(update, now);

      if (historyText !== null) {
        const json = parseJson(historyText);
        const list = Array.isArray(json) ? json : null;
        const good = (list ?? []).filter(isRecord);
        for (const record of good) r.history.save({ ...record, notes: record.notes ?? '' }, now);
        report.cooks = good.length;
        if (!list || good.length < list.length) lose('past cooks', 'history.json', historyText);
      }

      const kept = report.cookers + report.rates + report.cooks + (report.plan ? 1 : 0) + (report.runningCook ? 1 : 0);
      report.status = !hadData ? 'none' : report.lost.length === 0 ? 'done' : kept === 0 ? 'fresh' : 'partial';
      report.lost = LOST.filter(p => report.lost.includes(p));
      r.kv.set(IMPORT_KEY, report, now);
    });
  } catch {
    return {
      ...report,
      status: 'fresh',
      cookers: 0,
      rates: 0,
      cooks: 0,
      plan: false,
      runningCook: false,
      lost: [...LOST],
    };
  }

  if (report.status === 'done') {
    // The data is committed. If retiring fails the originals just stay; the saved report stops a second import.
    try {
      legacy.retireCapacitorPrefs();
      legacy.retireHistoryFile();
    } catch {
      // kept
    }
  }
  return report;
}

/** "a, b and c" */
const list = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

export const NOTICE_TITLE = 'Pit Planner has a new look';

/** The one-time notice after the import: null when there is nothing to say (no old data, or all of it kept). */
export function importNotice(report: ImportReport): { title: string; body: string } | null {
  if (report.noticeSeen || report.status === 'none' || report.status === 'done') return null;
  if (report.status === 'fresh') return { title: NOTICE_TITLE, body: 'It starts fresh. Set up your cookers again.' };
  const kept: string[] = [];
  if (report.cookers > 0) kept.push('cookers');
  if (report.rates > 0) kept.push('rates');
  if (report.plan) kept.push('plan');
  if (report.runningCook) kept.push('running cook');
  if (report.cooks > 0) kept.push(`${report.cooks} past ${report.cooks === 1 ? 'cook' : 'cooks'}`);
  const cameAlong = kept.length > 0 ? `Your ${list(kept)} came along. ` : '';
  // "Some past cooks" when others did come along; the rest are named plainly.
  const lost = report.lost.map(p => (p === 'past cooks' && report.cooks > 0 ? 'other past cooks' : p));
  return { title: NOTICE_TITLE, body: `${cameAlong}Your ${list(lost)} could not be moved.` };
}
