// node cook.mjs <outdir>: start a cook from the mockup menu (serve 13 hr out), capture the Cook tab,
// tap Done twice so the brisket goes on early and the Keep / Move sheet opens, apply Keep serve,
// open Cook options with +30, then End cook -> Cook finished -> Discard (history.json is not backed up).
// Cleans up after itself: cancels every alarm and clears the cook. Skips if a live cook has alarms set.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const settle = () => p.waitForTimeout(900);
// A cook with alarms set is live: leave it alone. A saved cook without alarms is restored by run.sh.
const live = await p.evaluate(async () => { const s = await window.Capacitor.Plugins.PitAlarms.getScheduled(); return s.alarms.some(a => !a.test) || s.nags.length > 0; });
if (live) { console.log('cook: a live cook has alarms set on the phone, skipped'); await b.close(); process.exit(0); }
await prefs(p, 'remove', 'activeCook');

const serve = await p.evaluate(() => { const d = new Date(Date.now() + 13 * 3600e3); d.setMinutes(0, 0, 0); return d.getTime(); });
const gear = { smoker: { id: 'pitboss-820', name: 'Pit Boss 820', type: 'pellet', tempStepF: 5, minTempF: 180, maxTempF: 500, hopperLb: 21, mainGrateSqIn: 593, upperRackSqIn: 256, pelletLbPerHrLow: 1.5, pelletLbPerHrHigh: 3, preheatMin: 20 },
  griddle: { id: 'griddle', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: false, preheatMin: 15 } };
const items = [
  { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
  { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 },
  { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded', brine: 'none' }, restMin: 8 },
];
await prefs(p, 'set', 'gear', JSON.stringify(gear));
await prefs(p, 'set', 'rates', JSON.stringify({ brisket: 0.75 }));
await prefs(p, 'set', 'settings', JSON.stringify({ temp: 'F', weight: 'lb' }));
await prefs(p, 'set', 'draft', JSON.stringify({ mode: 'readyBy', at: serve, pitTempF: 225, items }));
await p.reload(); await p.getByText('On the menu').waitFor(); await settle();

const result = {};
try {
  await p.getByRole('button', { name: 'Start cook' }).click(); await settle();
  const anyway = p.getByRole('button', { name: 'Start anyway' });
  if (await anyway.count()) { result.alertsMissing = true; await anyway.click(); await settle(); }
  await p.getByText('Cooking').first().waitFor();
  result.cook = await p.evaluate(() => {
    const t = s => document.querySelector(s)?.textContent;
    const nums = [...document.querySelectorAll('.num')];
    const clipped = nums.filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth).map(n => n.textContent);
    return { title: t('.appbar h1'), chip: t('.status-chip'), next: t('.t-nextTitle'), countdown: t('.t-countdown'), clippedNums: clipped };
  });
  screencap(`${out}/cook.png`);
  await p.getByRole('button', { name: 'Done', exact: true }).click(); await settle();   // fire the smoker
  await p.getByRole('button', { name: 'Done', exact: true }).click(); await settle();   // brisket on, early
  result.ask = await p.evaluate(() => document.querySelector('.sheet .t-sheetTitle')?.textContent ?? null);
  screencap(`${out}/cook-ask.png`);
  if (result.ask) { await p.getByRole('button', { name: 'Apply' }).click(); await settle(); }
  result.after = await p.evaluate(() => ({ chip: document.querySelector('.status-chip')?.textContent, next: document.querySelector('.t-nextTitle')?.textContent }));
  screencap(`${out}/cook-after.png`);
  await p.getByRole('button', { name: 'Cook options' }).click(); await settle();
  await p.getByRole('button', { name: 'More shift' }).click();
  await p.getByRole('button', { name: 'More shift' }).click(); await settle();
  result.options = await p.evaluate(() => ({ value: document.querySelector('.sheet .step-val')?.textContent, impact: [...document.querySelectorAll('.sheet .card-inset .t-label')].map(e => e.textContent).at(-1) }));
  screencap(`${out}/options.png`);
  await p.getByRole('button', { name: 'Close' }).click(); await settle();
  await p.getByRole('button', { name: 'Cook options' }).click(); await settle();   // reopen: must work like the first time
  result.sheets = await p.evaluate(() => document.querySelectorAll('.sheet').length);
  const end = p.getByRole('button', { name: /^End cook/ });
  await end.scrollIntoViewIfNeeded();
  result.endBox = await end.evaluate(e => { const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { y: Math.round(r.y), h: Math.round(r.height), vh: innerHeight, hit: top?.closest('button')?.textContent?.slice(0, 20) ?? top?.className }; });
  await end.click({ timeout: 5000 }); await settle();
  result.finish = await p.evaluate(() => ({ title: document.querySelector('.appbar h1')?.textContent, rows: [...document.querySelectorAll('.info-row')].map(e => e.textContent) }));
  screencap(`${out}/finish.png`);
  await p.getByRole('button', { name: 'Discard this cook' }).click(); await settle();
} catch (e) { result.error = String(e).slice(0, 300); screencap(`${out}/cook-error.png`); }
finally {
  await p.evaluate(() => window.Capacitor.Plugins.PitAlarms.cancelAll());
  await prefs(p, 'remove', 'activeCook');
}
writeFileSync(`${out}/cook.json`, JSON.stringify(result, null, 1));
console.log('cook', JSON.stringify(result));
await b.close();
