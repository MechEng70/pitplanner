import type { ItemInput } from '../../engine/types';
import { PLAN_FILE_NAME, pitPlanText, toPitPlan } from './pitPlanFile';
import { sharePlanFile } from './share';
import { shareTextFile } from './shareFile';

jest.mock('./shareFile', () => ({ shareTextFile: jest.fn(async () => {}) }));

test('the plan file goes to the share sheet as JSON under its own name', async () => {
  await sharePlanFile('cook.pitplan', '{"app":"pit-planner"}');
  expect(shareTextFile).toHaveBeenCalledTimes(1);
  expect(shareTextFile).toHaveBeenCalledWith('cook.pitplan', '{"app":"pit-planner"}', 'application/json', 'Share plan');
});

test('a share that fails rejects, so the caller decides what to do', async () => {
  jest.mocked(shareTextFile).mockRejectedValueOnce(new Error('no share sheet'));
  await expect(sharePlanFile('cook.pitplan', '{}')).rejects.toThrow('no share sheet');
});

describe('the .pitplan file', () => {
  const SERVE = Date.UTC(2026, 10, 14, 22, 0);
  const brisket: ItemInput = {
    id: 'b',
    foodId: 'brisket',
    methodId: 'smoked',
    quantity: 12,
    options: { wrap: 'paper' },
    restMin: 60,
  };

  test('is named as in 0.2.0', () => {
    expect(PLAN_FILE_NAME).toBe('cook.pitplan');
  });

  test('holds the app tag, version 1, the serve time as ISO text, the smoker temp and the menu', () => {
    expect(toPitPlan(SERVE, 225, [brisket])).toEqual({
      app: 'pit-planner',
      version: 1,
      serveAt: '2026-11-14T22:00:00.000Z',
      pitTempF: 225,
      items: [brisket],
    });
  });

  test("leaves out the sender's rate, total hours and timing model, and anything else on an item", () => {
    const tuned = {
      ...brisket,
      timingModel: 'totalHours',
      totalHours: 9,
      totalHoursAtF: 225,
      hrPerLb: 0.7,
      note: 'not a plan field',
    } as ItemInput;
    const file = toPitPlan(SERVE, 225, [tuned]);
    expect(file.items).toEqual([brisket]);
    expect(pitPlanText(file)).not.toMatch(/timingModel|totalHours|hrPerLb|note/);
  });

  test('an item with no options or rest has neither key', () => {
    const bare: ItemInput = { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 };
    expect(Object.keys(toPitPlan(SERVE, 250, [bare]).items[0]!)).toEqual(['id', 'foodId', 'methodId', 'quantity']);
  });

  test('the text is the file as JSON, indented by two', () => {
    const file = toPitPlan(SERVE, 225, [brisket]);
    expect(pitPlanText(file)).toBe(JSON.stringify(file, null, 2));
    expect(JSON.parse(pitPlanText(file))).toEqual(file);
  });
});
