// App state (D-5): loaded once from SQLite through the repositories, written back on every change. A port
// of legacy/src/lib/store.tsx; the write is synchronous, so a change is on disk before the screen redraws.
// Alarm sync after a cook change and the update check join in T-015 and T-034.

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CookLog, Cookers, PlanInput } from '../../engine/types.ts';
import type { Repos } from '../db/repos/index.ts';
import type { Flags } from '../db/repos/settings.ts';
import type { ActiveCook } from './cook.ts';
import type { Draft } from './draft.ts';
import type { Units } from './format.ts';
import { logsOf, type CookRecord } from './history.ts';
import type { UpdateInfo } from './update.ts';

export type { Draft } from './draft.ts';

export interface AppState {
  gear: Cookers;
  units: Units;
  draft: Draft;
  rates: Record<string, number>; // foodId -> hr/lb at 225F set by the user
  totalHours: Record<string, number>; // foodId -> saved default total hours on heat
  rateLocks: Record<string, boolean>; // foodId -> saved rate never blends with logged cooks
  update: UpdateInfo | null; // last update check (SPEC section 10)
  history: CookLog[]; // learned-from logs, derived from records
  records: CookRecord[];
  cook: ActiveCook | null; // running cook, written on every change (reboot restore reads it)
  flags: Flags;
  firstRun: boolean; // no gear saved yet: show Setup
  /** A plan draft was saved but could not be loaded; Plan says so until the plan is changed. */
  draftLost: boolean;
}

/** Next Saturday at 5:00 PM local, at least an hour out. Only used for a fresh draft. */
export function defaultServe(now: number): number {
  const d = new Date(now);
  d.setHours(17, 0, 0, 0);
  while (d.getDay() !== 6 || d.getTime() < now + 3_600_000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export const defaultDraft = (now: number): Draft => ({
  mode: 'readyBy',
  at: defaultServe(now),
  pitTempF: 225,
  items: [],
});

export function planInput(s: AppState): PlanInput {
  return {
    mode: s.draft.mode,
    at: s.draft.at,
    pitTempF: s.draft.pitTempF,
    cookers: s.gear,
    items: s.draft.items,
    rateOverrides: s.rates,
    rateLocks: s.rateLocks,
    history: s.history,
  };
}

/** Everything the app shows, read from storage. Unreadable values come back as defaults (repositories). */
export function loadState(repos: Repos, now: number): AppState {
  const draft = repos.settings.readDraft();
  const records = repos.history.list();
  return {
    gear: repos.cookers.load(),
    firstRun: repos.cookers.count() === 0,
    units: repos.settings.units(),
    draft: draft.value ?? defaultDraft(now),
    draftLost: draft.corrupt,
    ...repos.rates.load(),
    update: repos.settings.update(),
    history: logsOf(records),
    records,
    cook: repos.activeCook.load(),
    flags: repos.settings.flags(),
  };
}

export interface Store {
  state: AppState;
  setDraft: (fn: (d: Draft) => Draft) => void;
  setGear: (g: Cookers) => void;
  finishSetup: (g: Cookers, u: Units) => void;
  setUnits: (u: Units) => void;
  setCook: (c: ActiveCook | null) => void;
  addRecord: (r: CookRecord) => void;
  removeRecord: (id: string) => void;
  setFlags: (f: Flags) => void;
  setRate: (foodId: string, hrPerLb: number | null) => void;
  setTotalHours: (foodId: string, hours: number | null) => void;
  setRateLock: (foodId: string, locked: boolean) => void;
  setUpdate: (u: UpdateInfo) => void;
}

const Ctx = createContext<Store | null>(null);

interface Props {
  repos: Repos;
  /** The clock for write times and the default draft; tests pass a fixed one. */
  clock?: () => number;
  children: ReactNode;
}

export function StoreProvider({ repos, clock = Date.now, children }: Props) {
  const [state, setState] = useState(() => loadState(repos, clock()));
  // Writers read the latest state here, so two changes in one event both build on each other.
  const latest = useRef(state);

  const actions = useMemo((): Omit<Store, 'state'> => {
    const commit = (patch: Partial<AppState>) => {
      latest.current = { ...latest.current, ...patch };
      setState(latest.current);
    };
    const reloadHistory = () => {
      const records = repos.history.list();
      commit({ records, history: logsOf(records) });
    };
    return {
      setDraft(fn) {
        const draft = fn(latest.current.draft);
        // Replaces a draft that could not be loaded (the repository quarantines it first).
        repos.settings.setDraft(draft, clock());
        commit({ draft, draftLost: false });
      },
      setGear(gear) {
        repos.cookers.save(gear, clock());
        // Same answer a restart would give: saved gear ends the first run.
        commit({ gear, firstRun: repos.cookers.count() === 0 });
      },
      finishSetup(gear, units) {
        const now = clock();
        repos.cookers.save(gear, now);
        repos.settings.setUnits(units, now);
        commit({ gear, units, firstRun: false });
      },
      setUnits(units) {
        repos.settings.setUnits(units, clock());
        commit({ units });
      },
      setCook(cook) {
        if (cook) repos.activeCook.save(cook, clock());
        else repos.activeCook.clear(clock());
        commit({ cook });
      },
      addRecord(r) {
        repos.history.save(r, clock());
        reloadHistory();
      },
      removeRecord(id) {
        repos.history.remove(id, clock());
        reloadHistory();
      },
      setFlags(flags) {
        repos.settings.setFlags(flags, clock());
        commit({ flags });
      },
      setRate(foodId, hrPerLb) {
        repos.rates.setRate(foodId, hrPerLb, clock());
        commit(repos.rates.load());
      },
      setTotalHours(foodId, hours) {
        repos.rates.setTotalHours(foodId, hours, clock());
        commit(repos.rates.load());
      },
      setRateLock(foodId, locked) {
        repos.rates.setLock(foodId, locked, clock());
        commit(repos.rates.load());
      },
      setUpdate(update) {
        repos.settings.setUpdate(update, clock());
        commit({ update });
      },
    };
  }, [repos, clock]);

  const store = useMemo(() => ({ state, ...actions }), [state, actions]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
