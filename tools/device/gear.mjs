// node gear.mjs <outdir>: Gear tab (mockups 16-20). Sets mockup gear (Pit Boss 820, griddle, oven), captures
// Gear (top and scrolled), the Alerts and Units sheets, and Add a cooker after removing the oven.
// run.sh restores the real data afterwards. Does not touch history.json.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const settle = () => p.waitForTimeout(900);
const btn = (name, exact = true) => p.getByRole('button', { name, exact }).first();
const measure = () => p.evaluate(() => {
  const nums = [...document.querySelectorAll('.num, input, .list-row .t-bodyL')];
  const clipped = nums.filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth).map(n => n.textContent || n.value);
  const rows = [...document.querySelectorAll('.list-row')].map(r => r.innerText.replace(/\n+/g, ' | '));
  return { clipped, wide: document.documentElement.scrollWidth > innerWidth, rows };
});
const gear = { smoker: { id: 'pitboss-820', name: 'Pit Boss 820', type: 'pellet', tempStepF: 5, minTempF: 180, maxTempF: 500, hopperLb: 21, mainGrateSqIn: 593, upperRackSqIn: 256, pelletLbPerHrLow: 1.5, pelletLbPerHrHigh: 3, preheatMin: 20 },
  griddle: { id: 'griddle', name: 'Blackstone', sizeIn: 36, burners: 4, hasDome: false, preheatMin: 15 },
  oven: { id: 'oven', lowestTempF: 170, holdIn: 'ask' } };
const r = {};
try {
  await prefs(p, 'set', 'gear', JSON.stringify(gear));
  await prefs(p, 'set', 'settings', JSON.stringify({ temp: 'F', weight: 'lb' }));
  await prefs(p, 'remove', 'activeCook');
  await p.reload(); await btn('Gear').waitFor(); await btn('Gear').click(); await settle();
  r.gear = await measure(); screencap(`${out}/gear.png`);
  await p.evaluate(() => { const s = document.querySelector('.screen-body'); s.scrollTop = s.scrollHeight; }); await settle();
  screencap(`${out}/gear-end.png`);
  await btn('Alerts', false).click(); await settle();
  r.alerts = await measure(); screencap(`${out}/gear-alerts.png`);
  await btn('Close').click(); await settle();
  await btn('Units', false).click(); await settle();
  await p.getByRole('radio', { name: 'Celsius' }).click().catch(() => btn('Celsius').click()); await settle();
  screencap(`${out}/gear-units.png`);
  await btn('Close').click(); await settle();
  r.celsius = (await measure()).rows;
} catch (e) { r.error = String(e).slice(0, 300); screencap(`${out}/gear-error.png`); }
writeFileSync(`${out}/gear.json`, JSON.stringify(r, null, 1));
console.log('gear', JSON.stringify(r));
await b.close();
