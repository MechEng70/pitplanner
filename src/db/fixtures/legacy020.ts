// What a 0.2.0 (Capacitor) install holds, in the shapes read from a real one (key names and value types;
// no personal data): one JSON string per CapacitorStorage key, and files/history.json. Used by the import
// tests and written to the emulator by the `legacy-import` device test (tools/device/legacy-fixture.mjs).
import { buildPlan } from '../../../engine/plan.ts';
import type { Cookers } from '../../../engine/types.ts';
import { newCook } from '../../lib/cook.ts';
import { saturday } from '../../lib/fixtures/saturday.ts';
import { defaultGriddle, defaultOven } from '../../lib/gear.ts';
import type { CookRecord } from '../../lib/history.ts';
import { rules } from '../../lib/rules.ts';

export const legacyGear: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() };

const brisketLog = { foodId: 'brisket', methodId: 'smoke', smokerId: 'pb820', quantity: 12, pitTempF: 225 };
export const legacyRecords: CookRecord[] = [
  {
    // Saved before 0.2.0 kept the serve lateness: no lateMin.
    id: 'cook-1',
    date: Date.UTC(2026, 9, 3, 21, 0),
    notes: 'Wrapped at 165.',
    pitTempF: 225,
    items: [
      {
        name: 'Brisket',
        plannedMin: 540,
        actualMin: 565,
        log: { ...brisketLog, minutesOnHeat: 565, options: { wrap: 'paper' } },
      },
    ],
  },
  {
    id: 'cook-2',
    date: Date.UTC(2026, 9, 24, 21, 0),
    notes: '',
    pitTempF: 250,
    lateMin: 20,
    items: [
      { name: 'Brisket', plannedMin: 540, actualMin: 550, log: { ...brisketLog, pitTempF: 250, minutesOnHeat: 550 } },
      {
        name: 'Wings',
        plannedMin: 90,
        actualMin: 85,
        log: {
          foodId: 'wings',
          methodId: 'smoke',
          smokerId: 'pb820',
          quantity: 24,
          pitTempF: 250,
          minutesOnHeat: 85,
          discarded: true,
        },
      },
    ],
  },
];

export const legacyDraft = { mode: 'readyBy' as const, at: saturday.at, pitTempF: 225, items: saturday.items };

/** The running cook as 0.2.0 saved it, started at `startedAt` for the Saturday plan. */
export const legacyCook = (startedAt: number) => newCook(saturday, buildPlan(rules, saturday), startedAt);

/** The CapacitorStorage entries: every value a JSON string, as @capacitor/preferences wrote them. */
export function legacyPrefs(startedAt: number): Record<string, string> {
  const values: Record<string, unknown> = {
    gear: legacyGear,
    settings: { temp: 'F', weight: 'lb' },
    draft: legacyDraft,
    rates: { brisket: 0.75 },
    totalHours: { ribs: 5.5 },
    rateLocks: { brisket: true },
    flags: { rateHintShown: true },
    update: { checkedAt: startedAt, latest: null, url: null },
    activeCook: legacyCook(startedAt),
  };
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, JSON.stringify(v)]));
}

/** files/history.json: 0.2.0 wrote it with one-space indentation. */
export const legacyHistoryJson = (): string => JSON.stringify(legacyRecords, null, 1);
