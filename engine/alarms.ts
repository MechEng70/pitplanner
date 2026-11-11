// plan.events -> the alarm set the native scheduler gets (SPEC section 6, failure mode 11).
// Pure: the caller passes `now` and gets back the full set to replace whatever was scheduled.

import type { EventKind, Plan, PlanEvent } from './types.ts';

const MIN = 60_000;

export interface AlarmSpec {
  id: string;          // the step keys joined; groups can change on a replan, so nags are tracked per key
  at: number;          // epoch ms
  title: string;
  body: string;
  critical: boolean;
  keys: string[];      // eventKey() of every step in this alarm: stable across replans; Done / +15 / nags use these
}

/** Stable key for a step: event ids are renumbered on every derive, kind+item+phase are not. */
export const eventKey = (e: PlanEvent) => `${e.kind}:${e.itemId ?? ''}:${e.phaseId ?? ''}`;

const KIND_TITLE: Partial<Record<EventKind, string>> = {
  fire: 'Smoker', setPit: 'Smoker', refill: 'Smoker', pitOff: 'Smoker', griddleOn: 'Griddle', ovenOn: 'Oven', serve: 'Serve',
};

export interface KeyedEvent { key: string; event: PlanEvent }

/** Plan events in time order with a stable key each. Repeats of a key are numbered (refill, refill#2). */
export function keyedEvents(plan: Plan): KeyedEvent[] {
  const seen = new Map<string, number>();
  return [...plan.events].sort((a, b) => a.at - b.at).map(event => {
    const k = eventKey(event), n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return { key: n === 1 ? k : `${k}#${n}`, event };
  });
}

export interface AlarmOptions {
  done?: Iterable<string>;               // step keys already done: never scheduled
  reminders?: Record<string, number>;    // key -> ring again at (overdue steps after +15 / Not yet)
  quietUntil?: number;                   // Quiet alerts: nothing rings before this; one summary at the end
}

/**
 * Future alarm events, one alarm per minute: steps that land in the same minute share one
 * notification listing all of them. nameOf maps an itemId to the food name for the title.
 */
export function alarmsFromPlan(plan: Plan, now: number, nameOf?: (itemId: string) => string | undefined, opts: AlarmOptions = {}): AlarmSpec[] {
  const names = new Map(plan.items.map(it => [it.input.id, it.name]));
  const title = (e: PlanEvent) => (e.itemId && (nameOf?.(e.itemId) ?? names.get(e.itemId))) || KIND_TITLE[e.kind] || 'Pit Planner';
  const done = new Set(opts.done ?? []);

  // Each step rings at its plan time, or at its reminder time if one is set and later.
  let steps = keyedEvents(plan)
    .filter(k => k.event.alarm && !done.has(k.key))
    .map(k => ({ ...k, at: Math.max(k.event.at, opts.reminders?.[k.key] ?? -Infinity) }))
    .filter(s => s.at > now)
    .sort((a, b) => a.at - b.at);

  let summary: AlarmSpec | null = null;
  const q = opts.quietUntil;
  if (q != null && q > now) {
    const held = steps.filter(s => s.at < q);
    steps = steps.filter(s => s.at >= q);
    if (held.length) summary = {
      id: 'quiet|' + held.map(s => s.key).join('|'), at: q, title: 'Quiet time is over',
      body: held.map(s => s.event.label).join('\n'), critical: true, keys: held.map(s => s.key),
    };
  }

  const groups = new Map<number, typeof steps>();
  for (const s of steps) {
    const minute = Math.floor(s.at / MIN);
    groups.set(minute, [...(groups.get(minute) ?? []), s]);
  }
  const out = [...groups.values()].map(g => ({
    id: g.map(s => s.key).join('|'),
    at: g[0].at,
    title: [...new Set(g.map(s => title(s.event)))].join(' + '),
    body: g.map(s => s.event.label).join('\n'),
    critical: g.some(s => s.event.critical),
    keys: g.map(s => s.key),
  }));
  return summary ? [summary, ...out].sort((a, b) => a.at - b.at) : out;
}
