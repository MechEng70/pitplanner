// The words of Restore from a file (T-036; Jason, 2026-11-16): counts that read right for one, and every
// refusal ending "Nothing was changed."
import type { Dropped } from './dataFile';
import {
  RESTORE_FAILED,
  confirmText,
  countList,
  leftOutCount,
  leftOutText,
  refusalText,
  restoredText,
} from './restoreText';

const c = (cookers: number, rates: number, cooks: number) => ({ cookers, rates, cooks });

describe('countList', () => {
  test('many of each', () => {
    expect(countList(c(2, 3, 30))).toBe('2 cookers, 3 cook rates and 30 cooks');
  });
  test('one of each reads as one', () => {
    expect(countList(c(1, 1, 1))).toBe('1 cooker, 1 cook rate and 1 cook');
  });
  test('no cook rates and no cooks are said (a restore empties them); no cookers is left out (the phone keeps its own)', () => {
    expect(countList(c(0, 3, 30))).toBe('3 cook rates and 30 cooks');
    expect(countList(c(2, 0, 30))).toBe('2 cookers, no cook rates and 30 cooks');
    expect(countList(c(2, 3, 0))).toBe('2 cookers, 3 cook rates and no cooks');
    expect(countList(c(1, 0, 0))).toBe('1 cooker, no cook rates and no cooks');
    expect(countList(c(0, 0, 1))).toBe('no cook rates and 1 cook');
  });
});

describe('the confirm sheet', () => {
  test('the words Jason chose, with the date', () => {
    expect(confirmText(c(2, 3, 30), 'Nov 16')).toBe(
      'This file has 2 cookers, 3 cook rates and 30 cooks, from Nov 16. They replace what is on this phone. ' +
        'Your plan stays.',
    );
  });
  test('singular, and no date when the file has none', () => {
    expect(confirmText(c(1, 1, 1), null)).toBe(
      'This file has 1 cooker, 1 cook rate and 1 cook. They replace what is on this phone. Your plan stays.',
    );
  });
  test('zero cook rates and cooks are named (Jason, 2026-11-16)', () => {
    expect(confirmText(c(2, 0, 0), 'Nov 16')).toBe(
      'This file has 2 cookers, no cook rates and no cooks, from Nov 16. They replace what is on this phone. ' +
        'Your plan stays.',
    );
    expect(confirmText(c(0, 0, 4), 'Nov 2')).toBe(
      'This file has no cook rates and 4 cooks, from Nov 2. They replace what is on this phone. Your plan stays.',
    );
  });
});

describe('parts left out', () => {
  const d = (reason: Dropped['reason'], key = 'k'): Dropped => ({ part: 'history', key, reason });
  test('a cut note is kept, so it is not a part left out', () => {
    expect(leftOutCount([d('bad value'), d('notes cut'), d('unknown method'), d('duplicate')])).toBe(3);
  });
  test('none: no line', () => {
    expect(leftOutText([])).toBeNull();
    expect(leftOutText([d('notes cut')])).toBeNull();
  });
  test('one, and many', () => {
    expect(leftOutText([d('bad value')])).toBe('1 part of the file could not be read and is left out.');
    expect(leftOutText([d('bad value'), d('out of range'), d('duplicate'), d('unknown kind')])).toBe(
      '4 parts of the file could not be read and are left out.',
    );
  });
});

test('after Replace', () => {
  expect(restoredText(c(2, 3, 30))).toBe('Restored 2 cookers, 3 cook rates and 30 cooks.');
  expect(restoredText(c(1, 1, 1))).toBe('Restored 1 cooker, 1 cook rate and 1 cook.');
  expect(restoredText(c(0, 0, 5))).toBe('Restored no cook rates and 5 cooks.');
});

test('every refusal says why and ends "Nothing was changed."', () => {
  expect(refusalText('cook running')).toBe('End the cook first, then restore. Nothing was changed.');
  expect(refusalText('not ours')).toBe('This is not a Pit Planner data file. Nothing was changed.');
  expect(refusalText('not json')).toBe('This is not a Pit Planner data file. Nothing was changed.');
  expect(refusalText('newer')).toBe(
    'This file is from a newer Pit Planner. Update the app to restore it. Nothing was changed.',
  );
  expect(refusalText('damaged')).toBe('This file is damaged. Nothing was changed.');
  expect(refusalText('unreadable')).toBe('This file is damaged. Nothing was changed.');
  expect(refusalText('too big')).toBe('This file is too big to restore. Nothing was changed.');
  expect(refusalText('nothing to restore')).toBe('There is nothing to restore in this file. Nothing was changed.');
  expect(refusalText('failed')).toBe(RESTORE_FAILED);
  expect(RESTORE_FAILED).toMatch(/ Nothing was changed\.$/);
});
