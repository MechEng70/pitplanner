// Typed settings in kv: units, one-time flags, the last update check, the plan draft. A missing or corrupt
// value reads as its default (units F and lb, no flags) or null (update, draft: the store makes a new one).

import { parseDraft, type Draft } from '../../lib/draft.ts';
import type { Units } from '../../lib/format.ts';
import type { UpdateInfo } from '../../lib/update.ts';
import { isNum, isObj, isStr } from './json.ts';
import type { KvRepo } from './kv.ts';

export interface Flags {
  supportShown?: boolean;
  rateHintShown?: boolean;
}

export const DEFAULT_UNITS: Units = { temp: 'F', weight: 'lb' };

function parseUnits(raw: unknown): Units | null {
  if (!isObj(raw)) return null;
  const { temp, weight } = raw;
  if ((temp !== 'F' && temp !== 'C') || (weight !== 'lb' && weight !== 'kg')) return null;
  return { temp, weight };
}

function parseFlags(raw: unknown): Flags | null {
  if (!isObj(raw)) return null;
  const out: Flags = {};
  if (raw.supportShown === true) out.supportShown = true;
  if (raw.rateHintShown === true) out.rateHintShown = true;
  return out;
}

function parseUpdate(raw: unknown): UpdateInfo | null {
  if (!isObj(raw) || !isNum(raw.checkedAt)) return null;
  const strOrNull = (v: unknown) => (isStr(v) ? v : null);
  return { checkedAt: raw.checkedAt, latest: strOrNull(raw.latest), url: strOrNull(raw.url) };
}

/** Every setter quarantines an unreadable stored value before replacing it (quarantine.ts). */
export function settingsRepo(kv: KvRepo) {
  return {
    units: (): Units => kv.get('units', parseUnits) ?? DEFAULT_UNITS,
    setUnits: (u: Units, now: number) => kv.set('units', u, now, parseUnits),
    flags: (): Flags => kv.get('flags', parseFlags) ?? {},
    setFlags: (f: Flags, now: number) => kv.set('flags', f, now, parseFlags),
    update: (): UpdateInfo | null => kv.get('update', parseUpdate),
    setUpdate: (u: UpdateInfo, now: number) => kv.set('update', u, now, parseUpdate),
    draft: (): Draft | null => kv.get('draft', parseDraft),
    /** `corrupt`: a draft was saved but cannot be loaded (the Plan screen says so; it stays until replaced). */
    readDraft: (): { value: Draft | null; corrupt: boolean } => kv.read('draft', parseDraft),
    setDraft: (d: Draft, now: number) => kv.set('draft', d, now, parseDraft),
  };
}
export type SettingsRepo = ReturnType<typeof settingsRepo>;
