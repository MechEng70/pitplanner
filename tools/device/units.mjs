// node units.mjs <outdir>: Celsius + kilograms pass over the fixes for pellets (4), rules wording (5) and
// rounding (8). 12 lb brisket on the published rate (15 hr: over the 21 lb hopper) plus wings. Plan (orange
// Pellets tile), Conflicts sheet, Brisket details, then Cook: Next up and the full timeline. Alarms the dev
// copy scheduled are cancelled; run.sh restores the data.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const settle = () => p.waitForTimeout(900);
const btn = (name, exact = true) => p.getByRole('button', { name, exact }).first();
const texts = () => p.evaluate(() => {
  const body = document.querySelector('.sheet') ?? document.querySelector('.screen-body');
  const nums = [...document.querySelectorAll('.num, .chip, .t-nextTitle')];
  const clipped = nums.filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth).map(n => n.textContent);
  const t = body.innerText;
  return { clipped: [...new Set(clipped)], fahrenheit: t.match(/\d+F\b/g) ?? [], pounds: t.match(/\d+ lb\b/g) ?? [], text: t.replace(/\n+/g, ' | ').slice(0, 700) };
});
const serve = await p.evaluate(() => new Date(2026, 10, 14, 17, 0).getTime());
const gear = { smoker: { id: 'pitboss-820', name: 'Pit Boss 820', type: 'pellet', tempStepF: 5, minTempF: 180, maxTempF: 500, hopperLb: 21, mainGrateSqIn: 593, upperRackSqIn: 256, pelletLbPerHrLow: 1.5, pelletLbPerHrHigh: 3, preheatMin: 20 } };
const items = [
  { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
  { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 },
];
const r = {};
try {
  await prefs(p, 'set', 'gear', JSON.stringify(gear));
  await prefs(p, 'set', 'settings', JSON.stringify({ temp: 'C', weight: 'kg' }));
  await prefs(p, 'remove', 'rates'); await prefs(p, 'remove', 'totalHours');
  await prefs(p, 'set', 'flags', JSON.stringify({ rateHintShown: true }));
  await prefs(p, 'set', 'draft', JSON.stringify({ mode: 'readyBy', at: serve, pitTempF: 225, items }));
  await prefs(p, 'remove', 'activeCook');
  await p.reload(); await p.getByText('On the menu').waitFor(); await settle();
  r.plan = await texts();
  r.tiles = await p.evaluate(() => [...document.querySelectorAll('.tile')].map(t => `${t.innerText.replace(/\n+/g, ' ')} ${t.className}`));
  screencap(`${out}/u-plan.png`);
  await p.locator('.tile', { hasText: 'Pellets' }).click(); await settle();
  r.issues = await texts(); screencap(`${out}/u-issues.png`);
  await p.keyboard.press('Escape').catch(() => {});
  await btn('Close', false).click().catch(() => {}); await settle();
  await btn('Cook').click(); await settle();
  if (await p.getByText('Start anyway', { exact: false }).count()) { await btn('Start anyway', false).click(); await settle(); }
  r.cook = await texts(); screencap(`${out}/u-cook.png`);
  await btn('Full timeline', false).click().catch(e => r.timelineErr = String(e).slice(0, 100)); await settle();
  r.timeline = await texts(); screencap(`${out}/u-timeline.png`);
} catch (e) { r.error = String(e).slice(0, 300); screencap(`${out}/u-error.png`); }
try { await p.evaluate(() => window.Capacitor.Plugins.PitAlarms.cancelAll()); r.alarmsCancelled = true; } catch (e) { r.cancelErr = String(e).slice(0, 120); }
writeFileSync(`${out}/units.json`, JSON.stringify(r, null, 1));
console.log('units', JSON.stringify(r));
await b.close();
