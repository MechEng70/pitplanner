// App state: loaded once from storage, written back on every change.

import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import type { CookLog, Cookers, ItemInput, PlanInput } from '../../engine/types.ts';
import type { Units } from './format.ts';
import { load, save } from './storage.ts';
import { seedGear } from './gear.ts';

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
  history: CookLog[];              // TODO: load from the history file once Cook/End cook exist
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
    items: s.draft.items, rateOverrides: s.rates, history: s.history,
  };
}

interface Store {
  state: AppState;
  setDraft: (fn: (d: Draft) => Draft) => void;
  setGear: (g: Cookers) => void;
  setUnits: (u: Units) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ now, children }: { now: number; children: ComponentChildren }) {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    (async () => {
      const [gear, units, draft, rates] = await Promise.all([
        load<Cookers>('gear'), load<Units>('settings'), load<Draft>('draft'), load<Record<string, number>>('rates'),
      ]);
      setState({
        gear: gear ?? seedGear(),
        units: units ?? { temp: 'F', weight: 'lb' },
        draft: draft ?? { mode: 'readyBy', at: defaultServe(now), pitTempF: 225, items: [] },
        rates: rates ?? {},
        history: [],
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
  const setUnits = useCallback((units: Units) => setState(s => { save('settings', units); return s && { ...s, units }; }), []);

  if (!state) return null;
  return <Ctx.Provider value={{ state, setDraft, setGear, setUnits }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
