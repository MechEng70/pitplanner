// The anonymous GET behind the update check (GetJson): no cookies, no credentials, only the headers given.
import type { GetJson } from './types';

const TIMEOUT_MS = 15_000;

export const getJson: GetJson = async (url, headers) => {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, credentials: 'omit', signal: stop.signal });
    return { ok: r.ok, json: r.ok ? ((await r.json()) as unknown) : null };
  } finally {
    clearTimeout(timer);
  }
};
