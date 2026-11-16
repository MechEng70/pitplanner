// T-035 (security pass finding 4): a .pitplan file cannot freeze the app with a serve date far in the past,
// and its numbers are bounded like the rest of the parser's. Jest runs in America/New_York
// (jest.global-setup.js), so the weekly steps cross daylight saving time.
import foods from '../../data/foods.json';
import type { Rules } from '../../engine/rules';
import { parsePitPlan, PIT_TEMP_RANGE_F, SERVE_AT_RANGE, serveMove, suggestServe } from './sharedPlan';

const rules = foods as unknown as Rules;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** suggestServe as it was before T-035: one week at a time, as many turns as weeks have passed. */
function weekByWeek(sharedServe: number, now: number): number {
  if (sharedServe >= now + HOUR) return sharedServe;
  const d = new Date(sharedServe);
  while (d.getTime() < now + HOUR) d.setDate(d.getDate() + 7);
  return d.getTime();
}

const local = (y: number, m: number, d: number, h = 17, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('suggestServe: one computation, the same answers', () => {
  // Shared serve times: a Saturday at 5 PM, an evening, noon, just after midnight, and the minute after.
  const serves = [local(2026, 11, 14), local(2026, 11, 14, 19, 30), local(2026, 3, 7, 12), local(2026, 10, 31, 0, 15)];
  // Receiving times around both daylight saving changes of 2026 and 2027, and ordinary days.
  const nows = [
    local(2026, 3, 7, 12),
    local(2026, 3, 8, 3, 30),
    local(2026, 3, 9, 18),
    local(2026, 10, 31, 23),
    local(2026, 11, 1, 1, 30),
    local(2026, 11, 2, 9),
    local(2026, 11, 16, 12),
    local(2027, 3, 14, 4),
    local(2027, 6, 1, 8),
  ];

  test('agrees with the week-by-week answer for every pair, from minutes to months after', () => {
    for (const serve of serves)
      for (const now of nows)
        for (const shift of [-2 * HOUR, -HOUR, -HOUR + 1, -1, 0, 1, HOUR, 6 * DAY, 7 * DAY, 8 * DAY, 90 * DAY]) {
          const at = now + shift;
          expect([serve, at, suggestServe(serve, at)]).toEqual([serve, at, weekByWeek(serve, at)]);
        }
  });

  test('exactly a week, exactly an hour: the edges stay where they were', () => {
    const serve = local(2026, 11, 14);
    expect(suggestServe(serve, serve - HOUR)).toBe(serve);
    expect(suggestServe(serve, serve - HOUR + 1)).toBe(local(2026, 11, 21));
    // A week later at the same time is exactly an hour plus a week past an hour ago: not moved twice.
    expect(suggestServe(serve, local(2026, 11, 21) - HOUR)).toBe(local(2026, 11, 21));
    expect(suggestServe(serve, local(2026, 11, 21) - HOUR + 1)).toBe(local(2026, 11, 28));
  });

  test('a date years in the past: the next same weekday at the same local time, as before', () => {
    const serve = local(2020, 7, 4, 18);
    const now = local(2026, 11, 16, 12);
    const out = suggestServe(serve, now);
    expect(out).toBe(weekByWeek(serve, now));
    expect(out).toBe(local(2026, 11, 21, 18)); // 4 July 2020 was a Saturday
  });

  test('a date decades in the past: the same answer, at once', () => {
    const serve = local(1970, 1, 3, 17); // a Saturday
    const now = local(2026, 11, 16, 12);
    const t = performance.now();
    const out = suggestServe(serve, now);
    expect(performance.now() - t).toBeLessThan(20);
    expect(out).toBe(weekByWeek(serve, now));
    expect(out).toBe(local(2026, 11, 21, 17));
  });

  test('regression (finding 4): the earliest date JavaScript allows returns at once, not after 14 million turns', () => {
    const serve = -8.64e15; // -271821-04-20T00:00:00Z
    const now = local(2026, 11, 16, 12);
    const t = performance.now();
    const out = suggestServe(serve, now);
    expect(performance.now() - t).toBeLessThan(20);
    expect(out).toBeGreaterThanOrEqual(now + HOUR);
    expect(out).toBeLessThan(now + HOUR + 7 * DAY);
    expect(new Date(out).getDay()).toBe(new Date(serve).getDay());
  });

  test('the one difference: a serve time in the hour the clocks skip keeps its local time on later weeks', () => {
    // 2:30 AM on Sunday 1 March 2026; 8 March has no 2:30 AM. Week by week passed through it and stayed an hour
    // late (3:30 AM on the 15th); one step lands on the 15th at 2:30 AM, which exists.
    const serve = local(2026, 3, 1, 2, 30);
    const now = local(2026, 3, 14, 12);
    expect(weekByWeek(serve, now)).toBe(local(2026, 3, 15, 3, 30));
    expect(suggestServe(serve, now)).toBe(local(2026, 3, 15, 2, 30));
  });

  test('serveMove still agrees with it: kept exactly when the shared time is offered', () => {
    const serve = local(2026, 11, 14);
    for (const d of [-2 * HOUR, -HOUR, -HOUR + 1, -1, 0, 1, HOUR, 8 * DAY, 400 * DAY])
      expect(serveMove(serve, serve + d) === 'kept').toBe(suggestServe(serve, serve + d) === serve);
  });
});

describe('parsePitPlan: serve date and pit temp bounded', () => {
  const id = (i: number) => `n${i}`;
  const file = (over: object) =>
    JSON.stringify({
      app: 'pit-planner',
      version: 1,
      serveAt: '2026-11-14T22:00:00.000Z',
      pitTempF: 225,
      items: [{ foodId: 'brisket', methodId: 'smoked', quantity: 12 }],
      ...over,
    });
  const parsed = (over: object) => parsePitPlan(rules, file(over), id);

  test('regression (finding 4): a serve date outside 2000 to 2099 is a damaged file', () => {
    for (const serveAt of ['-271821-04-20T00:00:00.000Z', '1970-01-01T00:00:00.000Z', '1999-12-31T23:59:59.999Z'])
      expect(parsed({ serveAt })).toEqual({ error: 'This plan file is damaged.' });
    for (const serveAt of ['2100-01-01T00:00:00.000Z', '+275760-09-13T00:00:00.000Z'])
      expect(parsed({ serveAt })).toEqual({ error: 'This plan file is damaged.' });
    expect(parsed({ serveAt: '2000-01-01T00:00:00.000Z' })).toMatchObject({ serveAt: SERVE_AT_RANGE[0] });
    expect(parsed({ serveAt: '2099-12-31T23:59:59.999Z' })).toMatchObject({ serveAt: SERVE_AT_RANGE[1] - 1 });
  });

  test('regression (finding 4): the pit temp is clamped to the range a smoker can be set to, like quantity and rest', () => {
    const [lo, hi] = PIT_TEMP_RANGE_F;
    expect([lo, hi]).toEqual([150, 700]);
    expect(parsed({ pitTempF: 1e9 })).toMatchObject({ pitTempF: hi });
    expect(parsed({ pitTempF: -400 })).toMatchObject({ pitTempF: lo });
    expect(parsed({ pitTempF: 0 })).toMatchObject({ pitTempF: lo });
    expect(parsed({ pitTempF: 149 })).toMatchObject({ pitTempF: lo });
    expect(parsed({ pitTempF: 701 })).toMatchObject({ pitTempF: hi });
    // Inside the range it is kept, rounded to a whole degree like the rest time.
    for (const t of [150, 180, 225, 275, 500, 700]) expect(parsed({ pitTempF: t })).toMatchObject({ pitTempF: t });
    expect(parsed({ pitTempF: 225.4 })).toMatchObject({ pitTempF: 225 });
    // Not a number at all is still a damaged file, as before.
    for (const pitTempF of ['225', null, Number.NaN])
      expect(parsed({ pitTempF })).toEqual({ error: 'This plan file is damaged.' });
  });
});
