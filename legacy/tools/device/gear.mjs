// node gear.mjs <outdir>: Gear tab (mockups 16-20). Sets mockup gear (Pit Boss 820, griddle, oven), captures
// Gear (top and scrolled), the Alerts and Units sheets, and Add a cooker after removing the oven.
// Then Cook history with two sample cooks and the cook sheet. history.json is read first and written back
// (or deleted if there was none) before exiting; run.sh restores the rest.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const settle = () => p.waitForTimeout(900);
const btn = (name, exact = true) => p.getByRole('button', { name, exact }).first();
const measure = () =>
  p.evaluate(() => {
    const nums = [...document.querySelectorAll('.num, input, .list-row .t-bodyL')];
    const clipped = nums
      .filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth)
      .map(n => n.textContent || n.value);
    const rows = [...document.querySelectorAll('.list-row')].map(r => r.innerText.replace(/\n+/g, ' | '));
    return { clipped, wide: document.documentElement.scrollWidth > innerWidth, rows };
  });
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
  griddle: { id: 'griddle', name: 'Blackstone', sizeIn: 36, burners: 4, hasDome: false, preheatMin: 15 },
  oven: { id: 'oven', lowestTempF: 170, holdIn: 'ask' },
};
const r = {};
try {
  await prefs(p, 'set', 'gear', JSON.stringify(gear));
  await prefs(p, 'set', 'settings', JSON.stringify({ temp: 'F', weight: 'lb' }));
  await prefs(p, 'remove', 'activeCook');
  await p.reload();
  await btn('Gear').waitFor();
  await btn('Gear').click();
  await settle();
  r.gear = await measure();
  screencap(`${out}/gear.png`);
  await p.evaluate(() => {
    const s = document.querySelector('.screen-body');
    s.scrollTop = s.scrollHeight;
  });
  await settle();
  screencap(`${out}/gear-end.png`);
  await btn('Griddle', false).click();
  await settle();
  r.griddle = await measure();
  screencap(`${out}/griddle.png`);
  await p
    .getByRole('radio', { name: '28 in' })
    .click()
    .catch(e => (r.griddleErr = String(e).slice(0, 120)));
  await btn('Save griddle').click();
  await settle();
  r.griddleSaved = JSON.parse(await prefs(p, 'get', 'gear')).griddle;
  await btn('Oven', false).click();
  await settle();
  r.oven = await measure();
  screencap(`${out}/oven.png`);
  await btn('More lowest oven setting').click();
  await p.getByRole('radio', { name: 'Oven', exact: true }).click();
  await settle();
  await btn('Save oven').click();
  await settle();
  r.ovenSaved = JSON.parse(await prefs(p, 'get', 'gear')).oven;
  await btn('Alerts', false).click();
  await settle();
  r.alerts = await measure();
  screencap(`${out}/gear-alerts.png`);
  await btn('Close').click();
  await settle();
  await btn('Units', false).click();
  await settle();
  await p
    .getByRole('radio', { name: 'Celsius' })
    .click()
    .catch(() => btn('Celsius').click());
  await settle();
  screencap(`${out}/gear-units.png`);
  await btn('Close').click();
  await settle();
  r.celsius = (await measure()).rows;
  await btn('Units', false).click();
  await settle();
  await p.getByRole('radio', { name: 'Fahrenheit' }).click();
  await btn('Close').click();
  await settle();
} catch (e) {
  r.error = String(e).slice(0, 300);
  screencap(`${out}/gear-error.png`);
}

// Cook history with sample records; the real file is put back in finally.
const fs = (op, data) =>
  p.evaluate(
    async ([op, data]) => {
      const F = window.Capacitor.Plugins.Filesystem,
        o = { path: 'history.json', directory: 'DATA', encoding: 'utf8' };
      if (op === 'read') {
        try {
          return (await F.readFile(o)).data;
        } catch {
          return null;
        }
      }
      if (op === 'write') return F.writeFile({ ...o, data });
      if (op === 'delete') return F.deleteFile(o).catch(() => {});
    },
    [op, data],
  );
const realHistory = await fs('read');
try {
  const day = 864e5,
    now = Date.now();
  const lg = (foodId, methodId, quantity, min, x = {}) => ({
    foodId,
    methodId,
    smokerId: 'pitboss-820',
    quantity,
    pitTempF: 225,
    minutesOnHeat: min,
    ...x,
  });
  const recs = [
    {
      id: 't1',
      date: now - 2 * day,
      notes: 'Windy. Wrapped at 165F.',
      pitTempF: 225,
      lateMin: 0,
      items: [
        {
          name: 'Brisket',
          plannedMin: 700,
          actualMin: 675,
          log: lg('brisket', 'smoked', 12, 675, { options: { wrap: 'paper' } }),
        },
        { name: 'Chicken wings', plannedMin: 90, actualMin: 92, log: lg('wings', 'smokeCrisp', 2, 92) },
        { name: 'Chicken breasts', plannedMin: 20, actualMin: 20, log: lg('breasts', 'griddle', 4, 20) },
      ],
    },
    {
      id: 't2',
      date: now - 30 * day,
      notes: '',
      pitTempF: 250,
      lateMin: 25,
      items: [{ name: 'Pork butt', plannedMin: 600, actualMin: 640, log: lg('butt', 'smoked', 8, 640) }],
    },
  ];
  await fs('write', JSON.stringify(recs));
  await p.reload();
  await btn('Gear').waitFor();
  await btn('Gear').click();
  await settle();
  r.gearWithHistory = (await measure()).rows.find(x => x.includes('Cook rates'));
  await btn('Cook rates', false).click();
  await settle();
  r.history = await p.evaluate(() => ({
    text: document.querySelector('.screen-body').innerText.replace(/\n+/g, ' | '),
    clipped: [...document.querySelectorAll('.num, .t-tile')]
      .filter(n => n.scrollWidth > n.clientWidth + 1)
      .map(n => n.textContent),
  }));
  screencap(`${out}/history.png`);
  await p.locator('.card.rp').first().click();
  await settle();
  screencap(`${out}/history-cook.png`);
  await btn('Cook again').click();
  await settle();
  r.cookAgain = {
    draft: JSON.parse(await prefs(p, 'get', 'draft')).items.map(i => `${i.foodId} ${i.quantity}`),
    tab: await p.evaluate(() => document.querySelector('.appbar h1')?.textContent),
  };
} catch (e) {
  r.historyError = String(e).slice(0, 300);
  screencap(`${out}/history-error.png`);
} finally {
  if (realHistory == null) await fs('delete');
  else await fs('write', realHistory);
  r.historyRestored = (await fs('read')) === realHistory;
}
writeFileSync(`${out}/gear.json`, JSON.stringify(r, null, 1));
console.log('gear', JSON.stringify(r));
await b.close();
