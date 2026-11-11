// Drive the Pit Planner WebView on the phone over CDP; screenshots via adb screencap.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
export async function connect() {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const p = b.contexts()[0].pages()[0];
  return { b, p };
}
export const prefs = (p, op, key, value) => p.evaluate(async ([op, key, value]) => {
  const P = window.Capacitor.Plugins.Preferences;
  if (op === 'keys') return (await P.keys()).keys;
  if (op === 'get') return (await P.get({ key })).value;
  if (op === 'set') return P.set({ key, value });
  if (op === 'remove') return P.remove({ key });
}, [op, key, value]);
export function screencap(path) {
  writeFileSync(path, execFileSync('adb', ['-s', '5ece07c1', 'exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
}
