// Cook history view (mockup 20): rates per food per cooker, cook card lines, Cook again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CookLog } from './types.ts';
import { cookAgainItems, menuLine, missLine, rateRows, serveStatus } from '../src/lib/historyView.ts';
import type { CookRecord } from '../src/lib/history.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const U = { temp: 'F', weight: 'lb' } as const;
const log = (foodId: string, methodId: string, quantity: number, minutes: number, extra: Partial<CookLog> = {}): CookLog =>
  ({ foodId, methodId, smokerId: 'pb', quantity, pitTempF: 225, minutesOnHeat: minutes, ...extra });
const brisket = log('brisket', 'smoked', 12, 12 * 60, { options: { wrap: 'paper' } });
const record: CookRecord = { id: 'r', date: 0, notes: 'windy', pitTempF: 225, lateMin: 0, items: [
  { name: 'Brisket', plannedMin: 700, actualMin: 675, log: brisket },
  { name: 'Chicken wings', plannedMin: 90, actualMin: 91, log: log('wings', 'smokeCrisp', 2, 91) },
  { name: 'Chicken breasts', plannedMin: 20, actualMin: 20, log: log('breasts', 'griddle', 4, 20, { discarded: true }) },
] };

test('history: one rate row per by-weight food per cooker, cooks until size-adjusted', () => {
  const rows = rateRows(rules, [brisket, log('breasts', 'griddle', 4, 20)], {});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].foodName, 'Brisket');
  assert.equal(rows[0].cooks, 1);
  assert.equal(rows[0].untilSize, rules.learning.unlockAfterCooks - 1);
  assert.ok(rows[0].hrPerLb > 0);
  assert.equal(rateRows(rules, [{ ...brisket, discarded: true }], {}).length, 0);
});

test('history: cook card lines', () => {
  assert.equal(menuLine(rules, record, U), 'Brisket 12 lb, chicken wings 2 lb, 4 chicken breasts');
  assert.equal(missLine(record), 'Brisket 25 min ahead of plan');
  assert.deepEqual(serveStatus(record), { text: 'On time', tone: 'ok' });
  assert.deepEqual(serveStatus({ ...record, lateMin: 20 }), { text: '20 min late', tone: 'warn' });
  assert.deepEqual(serveStatus({ ...record, lateMin: null }), { text: 'Ended early', tone: 'secondary' });
  assert.equal(serveStatus({ ...record, lateMin: undefined }), null);
});

test('history: Cook again copies foods, sizes and options with default rest', () => {
  const items = cookAgainItems(rules, record, i => `n${i}`);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], { id: 'n0', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 });
});
