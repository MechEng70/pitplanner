import type { ItemInput } from '../../engine/types';
import { PLAN_FILE_NAME, pitPlanText, toPitPlan } from '@/lib/pitPlanFile';
import { checkOpened, MAX_PLAN_BYTES, planOpener, sharePlanFile, utf8Bytes } from './share';
import { shareTextFile } from './shareFile';

jest.mock('./shareFile', () => ({ shareTextFile: jest.fn(async () => {}) }));
// The native module is not in Jest: the opener is tested over a scripted source.
jest.mock('../../modules/pit-share', () => ({ pitShare: {} }));

describe('a .pitplan opened from another app (T-030)', () => {
  /** The native module, scripted: `waiting` is what the next take returns. */
  const source = () => {
    const fns = new Set<() => void>();
    const s = {
      waiting: null as unknown,
      takes: 0,
      async takeOpenedPlan() {
        s.takes++;
        const w = s.waiting;
        s.waiting = null;
        if (w instanceof Error) throw w;
        return w;
      },
      onPlanOpened(fn: () => void) {
        fns.add(fn);
        return () => void fns.delete(fn);
      },
      arrive(file: unknown) {
        s.waiting = file;
        fns.forEach(fn => fn());
      },
      listeners: () => fns.size,
    };
    return s;
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));

  describe('the size cap', () => {
    test('is 256 KB', () => {
      expect(MAX_PLAN_BYTES).toBe(262144);
    });

    test('a file of exactly the cap is taken; one byte more is refused and its text dropped', () => {
      expect(checkOpened({ text: 'a'.repeat(MAX_PLAN_BYTES) })).toEqual({ text: 'a'.repeat(MAX_PLAN_BYTES) });
      expect(checkOpened({ text: 'a'.repeat(MAX_PLAN_BYTES + 1) })).toEqual({ error: 'tooBig' });
    });

    test('the cap counts bytes, not characters', () => {
      // 100,000 three-byte characters: under the cap by length, over it in bytes.
      expect(checkOpened({ text: '€'.repeat(100_000) })).toEqual({ error: 'tooBig' });
      expect(utf8Bytes('aé€😀')).toBe(1 + 2 + 3 + 4);
    });

    test('the native too-big answer is passed on, whatever else came with it', () => {
      expect(checkOpened({ error: 'tooBig', text: '{}' })).toEqual({ error: 'tooBig' });
    });
  });

  test('only a string text counts as a file; anything else is unreadable', () => {
    expect(checkOpened({ text: '{}', name: 'cook.pitplan' })).toEqual({ text: '{}', name: 'cook.pitplan' });
    expect(checkOpened({ text: '{}', name: 7 })).toEqual({ text: '{}' });
    for (const bad of [null, undefined, 'text', 7, {}, { text: 7 }, { error: 'unreadable' }, { error: 'other' }]) {
      expect(checkOpened(bad)).toEqual({ error: 'unreadable' });
    }
  });

  test('a file that opened the app from cold is handed to the first listener', async () => {
    const s = source();
    s.waiting = { text: '{"app":"pit-planner"}', name: 'cook.pitplan' };
    const got = jest.fn();
    planOpener(s)(got);
    await flush();
    expect(got).toHaveBeenCalledTimes(1);
    expect(got).toHaveBeenCalledWith({ text: '{"app":"pit-planner"}', name: 'cook.pitplan' });
  });

  test('nothing waiting, nothing delivered', async () => {
    const s = source();
    const got = jest.fn();
    planOpener(s)(got);
    await flush();
    expect(s.takes).toBe(1);
    expect(got).not.toHaveBeenCalled();
  });

  test('a file that arrives while the app is open is delivered once', async () => {
    const s = source();
    const got = jest.fn();
    planOpener(s)(got);
    await flush();
    s.arrive({ text: '{}' });
    await flush();
    expect(got).toHaveBeenCalledTimes(1);
    expect(got).toHaveBeenCalledWith({ text: '{}' });
  });

  test('an oversized file arrives as an error', async () => {
    const s = source();
    const got = jest.fn();
    planOpener(s)(got);
    await flush();
    s.arrive({ text: 'a'.repeat(MAX_PLAN_BYTES + 1) });
    await flush();
    expect(got).toHaveBeenCalledWith({ error: 'tooBig' });
  });

  test('a native failure is an unreadable file, not a crash', async () => {
    const s = source();
    const got = jest.fn();
    planOpener(s)(got);
    await flush();
    s.arrive(new Error('context lost'));
    await flush();
    expect(got).toHaveBeenCalledWith({ error: 'unreadable' });
  });

  test('after unsubscribing nothing is delivered and the native listener is gone', async () => {
    const s = source();
    const got = jest.fn();
    const off = planOpener(s)(got);
    await flush();
    off();
    expect(s.listeners()).toBe(0);
    s.arrive({ text: '{}' });
    await flush();
    expect(got).not.toHaveBeenCalled();
  });
});

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
