// The app's own log of recent events (T-065): alarms set and fired, changes to a cook, errors. A capped ring
// kept as one kv row (`eventLog`); the store appends to it and "Send to developer" puts it in the file.
// Pure: no clock, no storage. Only what the app itself did or saw; nothing from the phone or other apps.

export const EVENT_LOG_KEY = 'eventLog';
/** The newest this many events are kept; older ones drop off. */
export const EVENT_LOG_MAX = 300;
/** One event's text is cut to this, so one long error cannot fill the row. */
export const EVENT_TEXT_MAX = 400;

/** `alarms`: the set given to the phone. `fired`: an alarm rang. `tap`: Done or +15 on an alert. */
export type LogKind = 'alarms' | 'fired' | 'tap' | 'cook' | 'error';
const KINDS: readonly string[] = ['alarms', 'fired', 'tap', 'cook', 'error'];

export interface LogEvent {
  at: number;
  kind: LogKind;
  text: string;
}

const isEvent = (v: unknown): v is LogEvent => {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.at === 'number' && Number.isFinite(e.at) && typeof e.text === 'string' && KINDS.includes(e.kind as string)
  );
};

/** The stored log, or null when it is not a list. Entries that are not events are dropped. */
export function parseEventLog(raw: unknown): LogEvent[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter(isEvent).map(e => ({ at: e.at, kind: e.kind, text: e.text }));
}

/** The log with one more event, oldest dropped past `max`. */
export function appendEvent(log: readonly LogEvent[], event: LogEvent, max = EVENT_LOG_MAX): LogEvent[] {
  const text = event.text.length > EVENT_TEXT_MAX ? `${event.text.slice(0, EVENT_TEXT_MAX)}...` : event.text;
  return [...log, { at: event.at, kind: event.kind, text }].slice(-max);
}

/** An error as log text: its message, never more. */
export const errorText = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/** The parts of a running cook the log looks at (ActiveCook has these). */
export interface LoggedCook {
  plan: { serveAt: number; events: readonly unknown[] };
  done: Record<string, number>;
  reminders: Record<string, number>;
  pitDownAt: number | null;
  quietUntil: number | null;
}

const iso = (at: number) => new Date(at).toISOString();

/** What changed between two saves of the running cook, in a line. Empty when nothing the log tracks did. */
export function describeCookChange(old: LoggedCook | null, next: LoggedCook | null): string {
  if (!old && !next) return '';
  if (!old && next) return `cook started: ${next.plan.events.length} events, serve ${iso(next.plan.serveAt)}`;
  if (old && !next) return 'cook ended';
  const a = old!,
    b = next!;
  const said: string[] = [];
  for (const k of Object.keys(b.done)) if (!(k in a.done)) said.push(`done ${k} at ${iso(b.done[k]!)}`);
  for (const k of Object.keys(a.done)) if (!(k in b.done)) said.push(`not done ${k}`);
  for (const k of Object.keys(b.reminders))
    if (a.reminders[k] !== b.reminders[k]) said.push(`reminder ${k} at ${iso(b.reminders[k]!)}`);
  for (const k of Object.keys(a.reminders)) if (!(k in b.reminders)) said.push(`reminder ${k} cleared`);
  if (a.pitDownAt !== b.pitDownAt) said.push(b.pitDownAt == null ? 'pit back up' : `pit out at ${iso(b.pitDownAt)}`);
  if (a.quietUntil !== b.quietUntil)
    said.push(b.quietUntil == null ? 'quiet ended' : `quiet until ${iso(b.quietUntil)}`);
  if (a.plan !== b.plan) {
    said.push(`plan changed: ${b.plan.events.length} events`);
    if (a.plan.serveAt !== b.plan.serveAt) said.push(`serve ${iso(a.plan.serveAt)} -> ${iso(b.plan.serveAt)}`);
  }
  return said.join('; ');
}
