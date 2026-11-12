// Cook finished (mockup 15): planned vs actual per food, the history record, and rate changes.
// Pure: rules and `now` are passed in.

import type { CookLog, PlannedItem } from '../../engine/types.ts';
import { onHeatSpan, rateFor, type Rules } from '../../engine/plan.ts';
import type { ActiveCook } from './cook.ts';
import type { CookRecord } from './history.ts';
import { fmtDuration, fmtTime } from './format.ts';

const MIN = 60_000;
/** Within this many minutes of plan reads as On plan. */
const ON_PLAN_MIN = 2;

export interface FinishRow {
  itemId: string;
  name: string;
  plannedMin: number;
  actualMin: number;
  logged: boolean; // came off heat during the cook; otherwise actual is unknown
  verdict: { tone: 'ok' | 'warn' | 'secondary'; text: string };
  log: CookLog; // discarded when the food never came off (cook ended early)
}

/** learned / blended: the rate plans use moves. waiting: saved rate held until enough cooks. Locked rates get no card. */
export interface RateChange {
  foodName: string;
  before: number;
  after: number;
  cooksLogged: number;
  kind: 'learned' | 'blended' | 'waiting';
  learnAfter: number;
}

export interface FinishSummary {
  date: number;
  served: string;
  lateMin: number | null;
  rows: FinishRow[];
  rates: RateChange[];
}

const find = (items: PlannedItem[], id: string) => items.find(i => i.input.id === id);

function verdict(planned: number, actual: number): FinishRow['verdict'] {
  const d = actual - planned;
  if (Math.abs(d) < ON_PLAN_MIN) return { tone: 'ok', text: 'On plan' };
  return d < 0 ? { tone: 'ok', text: `${fmtDuration(-d)} ahead` } : { tone: 'warn', text: `${fmtDuration(d)} behind` };
}

export function summarize(rules: Rules, c: ActiveCook, now: number): FinishSummary {
  const smokerId = c.input.cookers.smoker?.id ?? 'none';
  const rows: FinishRow[] = c.plan.items.map(it => {
    const id = it.input.id;
    const orig = find(c.original.items, id) ?? it;
    const span = onHeatSpan(it);
    const start = c.onAt[id] ?? span.start,
      end = c.offAt[id] ?? span.end;
    const plannedMin = onHeatSpan(orig).minutes;
    const actualMin = Math.max(0, Math.round((end - start) / MIN));
    const logged = id in c.offAt;
    return {
      itemId: id,
      name: it.name,
      plannedMin,
      actualMin,
      logged,
      verdict: logged ? verdict(plannedMin, actualMin) : { tone: 'secondary', text: 'Not logged' },
      log: {
        foodId: it.input.foodId,
        methodId: it.input.methodId,
        smokerId,
        quantity: it.input.quantity,
        pitTempF: c.plan.pitTempF,
        minutesOnHeat: actualMin,
        options: it.input.options,
        ...(logged ? {} : { discarded: true }),
      },
    };
  });

  const servedAt = Object.entries(c.done).find(([k]) => k.startsWith('serve:'))?.[1];
  const late = servedAt == null ? 0 : Math.round((servedAt - c.original.serveAt) / MIN);
  const served =
    servedAt == null
      ? `Ended at ${fmtTime(now)}, before serve.`
      : `Served at ${fmtTime(servedAt)}, ${Math.abs(late) < ON_PLAN_MIN ? 'on time' : late > 0 ? `${fmtDuration(late)} late` : `${fmtDuration(-late)} early`}.`;

  const history = c.input.history ?? [];
  const rates: RateChange[] = [];
  for (const r of rows) {
    const it = find(c.plan.items, r.itemId)!;
    if (!it.rateInfo || r.log.discarded) continue;
    // The rate future plans start from (a per-cook rate is not kept); a locked saved rate does not learn.
    if (c.input.rateLocks?.[it.input.foodId] && c.input.rateOverrides?.[it.input.foodId] != null) continue;
    const learnFrom = { ...it.input, hrPerLb: undefined };
    const model = it.rateInfo.model === 'sizeAdjusted' ? 'sizeAdjusted' : 'perPound';
    const before = rateFor(rules, learnFrom, smokerId, c.input.rateOverrides, history, model, c.input.rateLocks);
    const after = rateFor(
      rules,
      learnFrom,
      smokerId,
      c.input.rateOverrides,
      [...history, r.log],
      model,
      c.input.rateLocks,
    );
    const kind = after.source === 'override' ? 'waiting' : after.source === 'blended' ? 'blended' : 'learned';
    rates.push({
      foodName: it.name,
      before: before.rate,
      after: after.rate,
      cooksLogged: after.cooksLogged,
      kind,
      learnAfter: rules.learning.savedRateLearnsAfter,
    });
  }
  return { date: servedAt ?? c.original.serveAt, served, lateMin: servedAt == null ? null : late, rows, rates };
}

export function toRecord(s: FinishSummary, c: ActiveCook, notes: string, id: string): CookRecord {
  return {
    id,
    date: s.date,
    notes: notes.trim(),
    pitTempF: c.plan.pitTempF,
    lateMin: s.lateMin,
    items: s.rows.map(r => ({ name: r.name, plannedMin: r.plannedMin, actualMin: r.actualMin, log: r.log })),
  };
}
