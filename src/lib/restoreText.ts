// The words of Gear's Restore from a file (T-036; Jason, 2026-11-16, docs/design/TASKS.md). Pure: counts in,
// sentences out. Counts read right for one ("1 cook"). No cook rates and no cooks are said ("no cooks";
// Jason, 2026-11-16): a restore empties the phone's rates and cooks even when the file has none. No cookers
// is left out: a file with no cookers keeps the phone's cookers.
import type { DataCheck, Dropped, FileProblem } from './dataFile.ts';

export type Counts = Extract<DataCheck, { ok: true }>['counts'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 cookers, 3 cook rates and 30 cooks" */
export function countList(c: Counts): string {
  const parts = [
    c.cookers > 0 ? plural(c.cookers, 'cooker', 'cookers') : null,
    c.rates > 0 ? plural(c.rates, 'cook rate', 'cook rates') : 'no cook rates',
    c.cooks > 0 ? plural(c.cooks, 'cook', 'cooks') : 'no cooks',
  ].filter((p): p is string => p !== null);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The confirm sheet's text. `date`: when the file was made, as the phone shows it ("Nov 16"), if known. */
export function confirmText(c: Counts, date: string | null): string {
  const from = date ? `, from ${date}` : '';
  return `This file has ${countList(c)}${from}. They replace what is on this phone. Your plan stays.`;
}

/** Parts the reader left out. A note that was cut is kept (shorter), so it does not count. */
export const leftOutCount = (dropped: readonly Dropped[]) => dropped.filter(d => d.reason !== 'notes cut').length;

/** The confirm sheet's extra line when parts were left out; null when none were. */
export function leftOutText(dropped: readonly Dropped[]): string | null {
  const n = leftOutCount(dropped);
  if (n === 0) return null;
  return n === 1
    ? '1 part of the file could not be read and is left out.'
    : `${n} parts of the file could not be read and are left out.`;
}

/** After Replace. */
export const restoredText = (c: Counts) => `Restored ${countList(c)}.`;

const NOTHING_CHANGED = 'Nothing was changed.';

/**
 * A write that failed and was undone (src/db/restore.ts). Not in Jason's list (it should not happen): the
 * plainest true sentence.
 */
export const RESTORE_FAILED = `The restore did not work. ${NOTHING_CHANGED}`;

/**
 * Why nothing was restored. `unreadable`: the picker or the read failed, so the file is taken as damaged. A
 * file that is not JSON is not a Pit Planner data file, as Open shared plan says for a plan.
 */
export type Refusal = FileProblem | 'cook running' | 'unreadable' | 'failed';

export function refusalText(why: Refusal): string {
  switch (why) {
    case 'cook running':
      return `End the cook first, then restore. ${NOTHING_CHANGED}`;
    case 'not json':
    case 'not ours':
      return `This is not a Pit Planner data file. ${NOTHING_CHANGED}`;
    case 'newer':
      return `This file is from a newer Pit Planner. Update the app to restore it. ${NOTHING_CHANGED}`;
    case 'damaged':
    case 'unreadable':
      return `This file is damaged. ${NOTHING_CHANGED}`;
    case 'too big':
      return `This file is too big to restore. ${NOTHING_CHANGED}`;
    case 'nothing to restore':
      return `There is nothing to restore in this file. ${NOTHING_CHANGED}`;
    case 'failed':
      return RESTORE_FAILED;
  }
}
