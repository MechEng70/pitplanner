// node timing.mjs <outdir>: cook timing fix (HA-INTEGRATION "Do first"). New user (no saved rates), 12 lb
// brisket for a 5:00 PM serve. Brisket details in Hours per pound (set to 0.75, saved for future), Total hours
// and Size-adjusted; then Plan (fire about 6:20 AM) and Gear > Cook rates. run.sh restores the data.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const settle = () => p.waitForTimeout(800);
const btn = (name, exact = true) => p.getByRole('button', { name, exact }).first();
const measure = () =>
  p.evaluate(() => {
    const nums = [...document.querySelectorAll('.num, .chip, .tile *')];
    const clipped = nums
      .filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth)
      .map(n => n.textContent);
    const card = document.querySelector('.sheet .card-result');
    return {
      clipped: [...new Set(clipped)],
      wide: document.documentElement.scrollWidth > innerWidth,
      result: card?.innerText.replace(/\n+/g, ' | '),
    };
  });
const serve = await p.evaluate(() => new Date(2026, 10, 14, 17, 0).getTime());
const gear = {
  smoker: {
    id: 'pitboss-820',
    name: 'Pit Boss 820',
    type: 'pellet',
    tempStepF: 5,
    minTempF: 180,
    maxTempF: 500,
    hopperLb: 21,
    mainGrateSqIn: 593,
    upperRackSqIn: 256,
    pelletLbPerHrLow: 1.5,
    pelletLbPerHrHigh: 3,
    preheatMin: 20,
  },
  griddle: { id: 'griddle', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: false, preheatMin: 15 },
};
const r = {};
try {
  await prefs(p, 'set', 'gear', JSON.stringify(gear));
  await prefs(p, 'remove', 'rates');
  await prefs(p, 'remove', 'totalHours');
  await prefs(p, 'set', 'settings', JSON.stringify({ temp: 'F', weight: 'lb' }));
  await prefs(p, 'set', 'flags', JSON.stringify({}));
  await prefs(p, 'set', 'draft', JSON.stringify({ mode: 'readyBy', at: serve, pitTempF: 225, items: [] }));
  await prefs(p, 'remove', 'activeCook');
  await p.reload();
  await btn('Add food', false).waitFor();
  await settle();

  // Add brisket as a new user: published rate and the one-time hint.
  await btn('Add food', false).click();
  await settle();
  await btn('Brisket', false).click();
  await settle();
  r.published = await measure();
  screencap(`${out}/t-published.png`);
  for (let i = 0; i < 10; i++) await btn('Less hours per pound').click();
  await p.getByRole('checkbox', { name: /Use for future/ }).click();
  await settle();
  r.perPound = await measure();
  screencap(`${out}/t-perpound.png`);
  await p.getByRole('radio', { name: 'Total hours' }).click();
  await settle();
  r.total = await measure();
  screencap(`${out}/t-total.png`);
  await p.getByRole('radio', { name: 'Size-adjusted' }).click();
  await settle();
  r.size = await measure();
  screencap(`${out}/t-size.png`);
  await p.getByRole('radio', { name: 'Hours per pound' }).click();
  await p.getByRole('checkbox', { name: /Use for future/ }).click();
  await settle();
  await btn('Add to plan').click();
  await settle();
  r.rates = await prefs(p, 'get', 'rates');
  r.flags = await prefs(p, 'get', 'flags');
  r.planTiles = await p.evaluate(() =>
    [...document.querySelectorAll('.tile')].map(t => t.innerText.replace(/\n+/g, ' ')),
  );
  r.planCard = await p.evaluate(() =>
    [...document.querySelectorAll('.screen-body > .card')].map(c => c.innerText.replace(/\n+/g, ' | ')),
  );
  screencap(`${out}/t-plan.png`);

  await btn('Gear').click();
  await settle();
  await btn('Cook rates', false).click();
  await settle();
  r.rateCards = await p.evaluate(() =>
    [...document.querySelectorAll('.screen-body > .card')].slice(0, 4).map(c => c.innerText.replace(/\n+/g, ' | ')),
  );
  r.ratesClipped = (await measure()).clipped;
  screencap(`${out}/t-rates.png`);
  await btn('Brisket', false).click();
  await settle();
  r.rateSheet = (await measure()).clipped;
  screencap(`${out}/t-ratesheet.png`);
} catch (e) {
  r.error = String(e).slice(0, 300);
  screencap(`${out}/t-error.png`);
}
writeFileSync(`${out}/timing.json`, JSON.stringify(r, null, 1));
console.log('timing', JSON.stringify(r));
await b.close();
