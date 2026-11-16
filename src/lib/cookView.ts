// What the Cook tab shows, derived from the plan and the clock. Pure: `now` is passed in.

import type { Plan, PlannedItem, Warning } from '../../engine/types.ts';
import { CONFLICT_TOLERANCE_F } from '../../engine/plan.ts';
import { smokerConflicts, smokerOverlaps } from '../../engine/live.ts';
import { fmtDuration, fmtTemp, fmtTime, tx, type Units } from './format.ts';

const MIN = 60_000,
  HR = 60 * MIN;
/** Five minutes or more off the original plan reads as Behind or Ahead. */
export const DRIFT_MIN = 5;

export type CookStatus = { tone: 'ok' | 'warn'; label: 'On plan' | 'Behind' | 'Ahead' };

export function cookStatus(dueAt: number | null, drift: number, now: number): CookStatus {
  if (dueAt != null && now > dueAt) return { tone: 'warn', label: 'Behind' };
  if (drift >= DRIFT_MIN) return { tone: 'warn', label: 'Behind' };
  if (drift <= -DRIFT_MIN) return { tone: 'ok', label: 'Ahead' };
  return { tone: 'ok', label: 'On plan' };
}

/**
 * "in 1 hr 12 min", "now", "12 min overdue". Whole minutes, no seconds. Wrap only between "1 hr" and "12 min".
 * A day or more away reads in days and whole hours, to the nearest hour: "in 1 day 22 hr", "in 3 days"
 * (Jason, 2026-11-15: "40 hours and 50 minutes" is hard to read).
 */
export function countdown(dueAt: number, now: number): string {
  const d = dueAt - now;
  if (d >= 0) {
    const m = Math.ceil(d / MIN);
    if (m >= 24 * 60) {
      const hours = Math.round(m / 60),
        days = Math.floor(hours / 24),
        rest = hours % 24;
      return `in ${days} ${days === 1 ? 'day' : 'days'}${rest ? ` ${rest} hr` : ''}`;
    }
    return m < 1 ? 'now' : `in ${fmtDuration(m)}`;
  }
  return `${fmtDuration(Math.max(1, Math.floor(-d / MIN)))} overdue`;
}

/** Overline above the Next up title. */
export function overline(dueAt: number, checkStep: boolean, now: number): string {
  if (now > dueAt + MIN) return `Overdue since ${fmtTime(dueAt)}`;
  return `${checkStep ? 'Check at' : 'At'} ${fmtTime(dueAt)}`;
}

/** Minutes between off heat and slicing or serving. */
export const holdMin = (p: Plan, itemId: string): number => {
  const it = p.items.find(i => i.input.id === itemId);
  return it ? Math.round((p.serveAt - it.sliceMin * MIN - it.finish) / MIN) : 0;
};

/** Subtitles for Keep serve / Move serve: what happens to this food's hold or to serve time. */
export function holdImpact(before: Plan, after: Plan, itemId: string): string {
  const name = before.items.find(i => i.input.id === itemId)?.name ?? 'Food';
  const serveMoved = Math.round((after.serveAt - before.serveAt) / MIN);
  if (serveMoved)
    return `Serve ${fmtTime(after.serveAt)}, ${serveMoved > 0 ? 'later' : 'earlier'} by ${fmtDuration(Math.abs(serveMoved))}.`;
  const a = holdMin(before, itemId),
    b = holdMin(after, itemId);
  if (b < 0) return `${name}: off heat ${fmtDuration(-b)} after serve.`;
  if (a === b) return `${name} holds ${fmtDuration(b)}, as planned.`;
  return `${name} holds ${fmtDuration(Math.max(0, b))} instead of ${fmtDuration(Math.max(0, a))}.`;
}

/* ---------- Lane chart ---------- */

type Tone = 'smoke' | 'smoke2' | 'hot' | 'griddle' | 'oven' | 'hold';
export interface ViewLane {
  id: string;
  title: string;
  subtitle: string;
  segments: { start: number; end: number; label?: string; tone: Tone }[];
}

const HOT_OVER_F = 50;

function segments(it: PlannedItem, plan: Plan, u: Units) {
  let smoke = 0;
  const out: ViewLane['segments'] = it.phases.map(p => {
    const label = /^\d+F$/.test(p.short) ? fmtTemp(p.tempF, u, true) : p.short.toLowerCase();
    if (p.cooker === 'griddle' || p.cooker === 'oven') return { start: p.start, end: p.end, tone: p.cooker, label };
    const tone: Tone = p.tempF > plan.pitTempF + HOT_OVER_F ? 'hot' : smoke++ ? 'smoke2' : 'smoke';
    return { start: p.start, end: p.end, tone, label };
  });
  const holdEnd = plan.serveAt - it.sliceMin * MIN;
  if (holdEnd - it.finish >= 10 * MIN)
    out.push({ start: it.finish, end: holdEnd, tone: 'hold', label: it.restMin ? 'rest' : 'hold' });
  return out;
}

/** Chart window: from the top of the current hour to serve (an hour back if serve has passed). */
/** Chart window: the top of the hour of the first step (fire, griddle or first phase) to serve, so the whole cook shows. */
export function laneWindow(plan: Plan, _now?: number): { from: number; to: number } {
  const starts = [plan.fireAt, plan.griddleOnAt, ...plan.items.flatMap(it => it.phases.map(p => p.start))].filter(
    (x): x is number => x != null,
  );
  const d = new Date(Math.min(plan.serveAt - HR, ...starts));
  d.setMinutes(0, 0, 0);
  return { from: d.getTime(), to: plan.serveAt };
}

export function lanes(plan: Plan, u: Units, cookerName: (kind: string) => string): ViewLane[] {
  return plan.items.map(it => ({
    id: it.input.id,
    title: shortName(it.name),
    subtitle: cookerName(it.phases[0]?.cooker ?? 'smoker'),
    segments: segments(it, plan, u),
  }));
}

const shortHour = (ms: number) => {
  const d = new Date(ms),
    h = d.getHours(),
    m = d.getMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`;
};

/** Hour ticks (every 2 hr or wider so there are at most five), plus serve. "10a", "12p", "5:30p". */
export function laneTicks(from: number, to: number): { at: number; label: string }[] {
  const hours = (to - from) / HR;
  const step = Math.max(2, Math.ceil(hours / 4)) * HR;
  const out: { at: number; label: string }[] = [];
  // An hour tick closer than a tenth of the chart to serve would collide with the serve label.
  for (let t = from; t < to - Math.max(40 * MIN, (to - from) / 10); t += step) out.push({ at: t, label: shortHour(t) });
  out.push({ at: to, label: shortHour(to) });
  return out;
}

/** "Today", "Tomorrow" or "Sat". */
export function dayWord(ms: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diff = Math.round((day(ms) - day(now)) / (24 * HR));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(ms);
}

/** "10 AM" or "10:30 AM" */
export const hourText = (ms: number) => fmtTime(ms).replace(':00', '');

/* ---------- Shared smoker note ---------- */

export interface OverlapNote {
  band: { start: number; end: number; laneIds: string[] };
  lead: string;
  rest: string;
}

/** "Chicken wings" -> "Wings": lane labels and notes are narrow. */
export const shortName = (name: string) => {
  const n = name.replace(/^Chicken /, '');
  return n.charAt(0).toUpperCase() + n.slice(1);
};

const list = (names: string[]) =>
  names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The next stretch where foods share the smoker, worded as in mockup 12:
 * "3:15 to 3:40 PM: brisket and wings share the smoker at 225F." + "Brisket comes off before the pit climbs to 400F."
 *
 * When the foods in that stretch need temps too far apart (a smoker conflict, T-069) the note is about the
 * conflict instead, with its own times and band: "3:15 to 3:40 PM: smoker conflict, brisket at 225F and
 * wings at 400F." (Jason, 2026-11-16).
 */
export function overlapNote(plan: Plan, now: number, u: Units): OverlapNote | null {
  const o = smokerOverlaps(plan).find(x => x.end > now);
  if (!o) return null;
  const span = (start: number, end: number) => {
    const a = fmtTime(start),
      b = fmtTime(end);
    return `${a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a} to ${b}`;
  };
  const clash = smokerConflicts(plan).find(c => c.end > now && c.start < o.end && c.end > o.start);
  if (clash) {
    const foods = clash.foods.map(f => {
      const it = plan.items.find(i => i.input.id === f.itemId);
      return `${it ? shortName(it.name).toLowerCase() : 'food'} at ${fmtTemp(f.tempF, u, true)}`;
    });
    return {
      band: { start: clash.start, end: clash.end, laneIds: clash.foods.map(f => f.itemId).sort() },
      lead: `${span(clash.start, clash.end)}: smoker conflict, ${list(foods)}.`,
      rest: '',
    };
  }
  const items = plan.items.filter(i => o.itemIds.includes(i.input.id));
  const names = items.map(i => shortName(i.name).toLowerCase());
  const temp = Math.min(...o.tempsF);
  const lead = `${span(o.start, o.end)}: ${list(names)} share the smoker at ${fmtTemp(temp, u, true)}.`;
  // One food comes off where the stretch ends, and another later needs the pit hotter.
  const leaving = items.find(i => Math.abs(i.finish - o.end) < MIN);
  const climbing = items
    .filter(i => i !== leaving)
    .flatMap(i => i.phases)
    .filter(p => p.cooker === 'smoker' && p.start >= o.end - MIN && p.tempF > temp)
    .sort((x, y) => x.start - y.start)[0];
  const rest =
    leaving && climbing
      ? `${cap(leaving.name.toLowerCase())} comes off before the pit climbs to ${fmtTemp(climbing.tempF, u, true)}.`
      : '';
  return { band: { start: o.start, end: o.end, laneIds: o.itemIds }, lead, rest };
}

/* ---------- Running behind or ahead ---------- */

/**
 * One line under Keep / Move serve (mockup 13): "Brisket hold drops from 60 to 30 min. Still OK."
 * Names the food whose hold changes most; warns when it falls under that food's shortest rest.
 */
export function shiftImpact(before: Plan, after: Plan): { tone: 'ok' | 'warn'; text: string } | null {
  const moved = Math.round((after.serveAt - before.serveAt) / MIN);
  if (moved) return { tone: 'ok', text: `Serve moves to ${fmtTime(after.serveAt)}. Holds stay as planned.` };
  const changes = before.items
    .map(it => ({ it, a: holdMin(before, it.input.id), b: holdMin(after, it.input.id) }))
    .filter(x => x.a !== x.b)
    .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
  const top = changes[0];
  if (!top) return null;
  const name = shortName(top.it.name);
  const b = Math.max(0, top.b);
  const verb = b < top.a ? 'drops' : 'grows';
  const floor = top.it.restFloorMin;
  const short = b < floor;
  return {
    tone: short ? 'warn' : 'ok',
    text: `${name} hold ${verb} from ${fmtDuration(top.a)} to ${fmtDuration(b)}. ${short ? `Under its ${fmtDuration(floor)} minimum rest.` : 'Still OK.'}`,
  };
}

/* ---------- Warnings made during the cook (T-069) ---------- */

/** One banner: every sentence in `text`, and the warnings it speaks for (what OK hides). */
export interface LiveWarnings {
  keys: string[];
  text: string;
}

/** A warning is the same warning while its code and foods are the same; its wording may change. */
export const warningKey = (w: Warning) => `${w.code}:${[...(w.itemIds ?? [])].sort().join('|')}`;

/** Does the plan still have a stretch ahead where these two foods need the smoker too far apart? */
function conflictAhead(plan: Plan, ids: string[], now: number): boolean {
  return smokerConflicts(plan).some(c => {
    if (c.end <= now) return false;
    const temps = c.foods.filter(f => ids.includes(f.itemId)).map(f => f.tempF);
    return temps.length > 1 && Math.max(...temps) - Math.min(...temps) > CONFLICT_TOLERANCE_F;
  });
}

/** "Brisket holds 5 hr, past its 4 hr limit. Keep it above 140F." Nothing about the griddle: not mid-cook. */
function holdSentence(plan: Plan, itemId: string): string | null {
  const it = plan.items.find(i => i.input.id === itemId);
  if (!it) return null;
  const hold = fmtDuration(holdMin(plan, itemId));
  return `${cap(it.label ?? it.name)} holds ${hold}, past its ${fmtDuration(it.holdLimitMin)} limit.${it.holdNote ? ` ${it.holdNote}` : ''}`;
}

/**
 * What the Live cook banner says (Jason, 2026-11-16): the smoker conflicts and the holds past their limit
 * that the plan has now and did not have at Start cook (`original`), less the ones hidden with OK (`seen`).
 * Conflicts first, in the engine's words; then holds, with durations as Live cook writes them. A conflict
 * whose stretch is over is left out. Null when there is nothing to say.
 */
export function liveWarnings(
  plan: Plan,
  original: Plan,
  seen: readonly string[],
  now: number,
  u: Units,
): LiveWarnings | null {
  const had = new Set((original.warnings ?? []).map(warningKey));
  const hidden = new Set(seen ?? []);
  const out: { key: string; text: string }[] = [];
  for (const code of ['PIT_CONFLICT', 'HOLD_TOO_LONG'])
    for (const w of plan.warnings ?? []) {
      const key = warningKey(w);
      if (w.code !== code || had.has(key) || hidden.has(key) || out.some(x => x.key === key)) continue;
      const ids = w.itemIds ?? [];
      if (code === 'PIT_CONFLICT') {
        if (conflictAhead(plan, ids, now)) out.push({ key, text: w.message });
        continue;
      }
      const text = ids[0] ? holdSentence(plan, ids[0]) : null;
      if (text) out.push({ key, text });
    }
  if (!out.length) return null;
  return { keys: out.map(x => x.key), text: tx(out.map(x => x.text).join(' '), u) };
}
