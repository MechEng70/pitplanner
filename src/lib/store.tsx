// App state: loaded once from storage, written back on every change.

import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import type { CookLog, Cookers, ItemInput, PlanInput } from '../../engine/types.ts';
import type { Units } from './format.ts';
import { load, save, remove } from './storage.ts';
import { normalize, type ActiveCook } from './cook.ts';
import { loadHistory, saveHistory, logsOf, type CookRecord } from './history.ts';

export interface Draft {
  mode: 'readyBy' | 'startAt';
  at: number;               // serve time (readyBy) or first-step time (startAt), epoch ms
  pitTempF: number;
  items: ItemInput[];
}

export interface AppState {
  gear: Cookers;
  units: Units;
  draft: Draft;
  rates: Record<string, number>;   // foodId -> hr/lb at 225F set by the user
  totalHours: Record<string, number>; // foodId -> saved default total hours on heat
  rateLocks: Record<string, boolean>; // foodId -> saved rate never blends with logged cooks
  history: CookLog[];              // learned-from logs, derived from records
  records: CookRecord[];           // history file
  cook: ActiveCook | null;         // running cook, written on every change (reboot restore reads it)
  flags: { supportShown?: boolean; rateHintShown?: boolean };
  firstRun: boolean;               // no gear saved yet: show Setup
}

/** Next Saturday at 5:00 PM local, at least an hour out. Only used for a fresh draft. */
export function defaultServe(now: number): number {
  const d = new Date(now);
  d.setHours(17, 0, 0, 0);
  while (d.getDay() !== 6 || d.getTime() < now + 3_600_000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function planInput(s: AppState): PlanInput {
  return {
    mode: s.draft.mode, at: s.draft.at, pitTempF: s.draft.pitTempF, cookers: s.gear,
    items: s.draft.items, rateOverrides: s.rates, rateLocks: s.rateLocks, history: s.history,
  };
}

interface Store {
  state: AppState;
  setDraft: (fn: (d: Draft) => Draft) => void;
  setGear: (g: Cookers) => void;
  finishSetup: (g: Cookers, u: Units) => void;
  setUnits: (u: Units) => void;
  setCook: (c: ActiveCook | null) => void;
  addRecord: (r: CookRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  setFlags: (f: AppState['flags']) => void;
  setRate: (foodId: string, hrPerLb: number | null) => void;
  setTotalHours: (foodId: string, hours: number | null) => void;
  setRateLock: (foodId: string, locked: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ now, children }: { now: number; children: ComponentChildren }) {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    (async () => {
      const [gear, units, draft, rates, totalHours, rateLocks, cook, flags, records] = await Promise.all([
        load<Cookers>('gear'), load<Units>('settings'), load<Draft>('draft'), load<Record<string, number>>('rates'),
        load<Record<string, number>>('totalHours'), load<Record<string, boolean>>('rateLocks'), load<unknown>('activeCook'), load<AppState['flags']>('flags'), loadHistory(),
      ]);
      setState({
        gear: gear ?? {},
        firstRun: gear == null,
        units: units ?? { temp: 'F', weight: 'lb' },
        draft: draft ?? { mode: 'readyBy', at: defaultServe(now), pitTempF: 225, items: [] },
        rates: rates ?? {},
        totalHours: totalHours ?? {},
        rateLocks: rateLocks ?? {},
        history: logsOf(records),
        records,
        cook: normalize(cook),
        flags: flags ?? {},
      });
    })();
  }, []);

  const setDraft = useCallback((fn: (d: Draft) => Draft) => setState(s => {
    if (!s) return s;
    const draft = fn(s.draft);
    save('draft', draft);
    return { ...s, draft };
  }), []);
  const setGear = useCallback((gear: Cookers) => setState(s => { save('gear', gear); return s && { ...s, gear }; }), []);
  const finishSetup = useCallback((gear: Cookers, units: Units) => setState(s => {
    save('gear', gear); save('settings', units);
    return s && { ...s, gear, units, firstRun: false };
  }), []);
  const setUnits = useCallback((units: Units) => setState(s => { save('settings', units); return s && { ...s, units }; }), []);
  const setCook = useCallback((cook: ActiveCook | null) => setState(s => {
    if (cook) save('activeCook', cook); else remove('activeCook');
    return s && { ...s, cook };
  }), []);
  const setFlags = useCallback((flags: AppState['flags']) => setState(s => { save('flags', flags); return s && { ...s, flags }; }), []);
  const setRate = useCallback((foodId: string, v: number | null) => setState(s => {
    if (!s) return s;
    const rates = withValue(s.rates, foodId, v);
    save('rates', rates);
    return { ...s, rates };
  }), []);
  const setTotalHours = useCallback((foodId: string, v: number | null) => setState(s => {
    if (!s) return s;
    const totalHours = withValue(s.totalHours, foodId, v);
    save('totalHours', totalHours);
    return { ...s, totalHours };
  }), []);
  const setRateLock = useCallback((foodId: string, locked: boolean) => setState(s => {
    if (!s) return s;
    const rateLocks = { ...s.rateLocks };
    if (locked) rateLocks[foodId] = true; else delete rateLocks[foodId];
    save('rateLocks', rateLocks);
    return { ...s, rateLocks };
  }), []);
  const addRecord = useCallback(async (r: CookRecord) => {
    const records = [...(await loadHistory()), r];
    await saveHistory(records);
    setState(s => s && { ...s, records, history: logsOf(records) });
  }, []);

  const removeRecord = useCallback(async (id: string) => {
    const records = (await loadHistory()).filter(r => r.id !== id);
    await saveHistory(records);
    setState(s => s && { ...s, records, history: logsOf(records) });
  }, []);

  if (!state) return null;
  return <Ctx.Provider value={{ state, setDraft, setGear, finishSetup, setUnits, setCook, addRecord, removeRecord, setFlags, setRate, setTotalHours, setRateLock }}>{children}</Ctx.Provider>;
}

function withValue(m: Record<string, number>, k: string, v: number | null): Record<string, number> {
  const out = { ...m };
  if (v == null) delete out[k]; else out[k] = v;
  return out;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
