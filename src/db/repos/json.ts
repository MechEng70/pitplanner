// Reading JSON columns safely: a corrupt value reads as "nothing", never as a throw (TASKS T-009).

export function parseJson(text: string | null | undefined): unknown {
  if (text == null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);
/** An optional field: absent, or passing the check. */
export const opt = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
export const isStrMap = (v: unknown): v is Record<string, string> => isObj(v) && Object.values(v).every(isStr);
