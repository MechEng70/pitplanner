// Share plan (SPEC section 3 "Share"). Out (T-029): the .pitplan text goes to a cache file and the Android
// share sheet opens for it. In (T-030): a .pitplan opened from another app (Gmail, Drive, a file manager)
// reaches the app through the pit-share native module, which reads the intent's content:// or file:// URI
// with a 256 KB cap. expo-file-system is not used for the read: it cannot see a SEND intent's file, and it
// reads a file whole, so the cap could not be kept for a provider that reports no size or a wrong one.
// The text is untrusted: the cap is checked again here, and src/lib/sharedPlan.ts checks every field.
import { pitShare } from '../../modules/pit-share';
import { shareTextFile } from './shareFile';
import type { OpenedPlanFile, ShareService, Unsubscribe } from './types';

export const sharePlanFile: ShareService['sharePlanFile'] = (name, text) =>
  shareTextFile(name, text, 'application/json', 'Share plan');

/** The largest .pitplan the app reads (TECH-DESIGN section 10). A real plan is a few KB. */
export const MAX_PLAN_BYTES = 256 * 1024;

export type OpenedPlan = OpenedPlanFile;
/** `error` values: the file is over the cap, or it could not be read at all. */
export const TOO_BIG = 'tooBig';
export const UNREADABLE = 'unreadable';

/** Bytes of `s` as UTF-8, counted without building the bytes; stops counting once past `stopAfter`. */
export function utf8Bytes(s: string, stopAfter = Infinity): number {
  let n = 0;
  for (let i = 0; i < s.length && n <= stopAfter; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
      n += 4; // a surrogate pair is one 4-byte character
      i++;
    } else n += 3;
  }
  return n;
}

/**
 * What the native side handed over, as the app takes it: only a string `text` within the cap counts as a
 * file, and only a string `name` is kept. Anything else is an error, never a throw.
 */
export function checkOpened(taken: unknown): OpenedPlan {
  const t = (taken && typeof taken === 'object' ? taken : {}) as Record<string, unknown>;
  if (t.error === TOO_BIG) return { error: TOO_BIG };
  if (typeof t.text !== 'string') return { error: UNREADABLE };
  if (utf8Bytes(t.text, MAX_PLAN_BYTES) > MAX_PLAN_BYTES) return { error: TOO_BIG };
  return typeof t.name === 'string' ? { text: t.text, name: t.name } : { text: t.text };
}

/** The native module's two calls (modules/pit-share), so tests can pass a fake. */
export interface PlanSource {
  takeOpenedPlan(): Promise<unknown>;
  onPlanOpened(fn: () => void): Unsubscribe;
}

/**
 * `ShareService.onPlanOpened` over the native module. A file that opened the app from cold is waiting
 * before anything listens, so the first listener is asked for it at once; later files arrive as events.
 * Each file is handed over once.
 */
export function planOpener(source: PlanSource): ShareService['onPlanOpened'] {
  return fn => {
    let live = true;
    const take = () =>
      void source.takeOpenedPlan().then(
        taken => {
          if (live && taken != null) fn(checkOpened(taken));
        },
        () => {
          if (live) fn({ error: UNREADABLE });
        },
      );
    take();
    const off = source.onPlanOpened(take);
    return () => {
      live = false;
      off();
    };
  };
}

export const shareService: ShareService = { sharePlanFile, onPlanOpened: planOpener(pitShare) };
