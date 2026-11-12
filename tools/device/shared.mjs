// node shared.mjs <outdir>: Open shared plan (mockup 11). Receiver has a smoker and no griddle. A .pitplan is
// pushed to the dev copy's own files dir and opened with a VIEW intent (as a file manager would). Then
// Use this plan, the Plan screen, and the Cook tab (starts the cook: Next up reads "Fire the smoker ... in N hr").
// Alarms the dev copy scheduled are cancelled at the end; run.sh restores the data.
import { connect, prefs, screencap } from './phone.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const PKG = 'io.github.mecheng70.pitplanner.debug';
const adb = (...a) => execFileSync('adb', ['-s', '5ece07c1', ...a]).toString();
const { b, p } = await connect();
const settle = () => p.waitForTimeout(900);
const btn = (name, exact = true) => p.getByRole('button', { name, exact }).first();
const measure = () =>
  p.evaluate(() => {
    const nums = [...document.querySelectorAll('.num, .chip, .t-nextTitle')];
    const clipped = nums
      .filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth)
      .map(n => n.textContent);
    const sheet = document.querySelector('.sheet');
    return {
      clipped: [...new Set(clipped)],
      wide: document.documentElement.scrollWidth > innerWidth,
      sheet: sheet?.innerText.replace(/\n+/g, ' | '),
    };
  });
const serve = await p.evaluate(() => new Date(2026, 10, 14, 17, 0).toISOString());
const file = {
  app: 'pit-planner',
  version: 1,
  serveAt: serve,
  pitTempF: 225,
  items: [
    { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
    { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 },
    {
      id: 'c',
      foodId: 'breasts',
      methodId: 'griddle',
      quantity: 4,
      options: { thickness: 'pounded', brine: 'none' },
      restMin: 8,
    },
  ],
};
const traeger = {
  id: 'traeger-pro-780',
  name: 'Traeger Pro 780',
  type: 'pellet',
  tempStepF: 5,
  minTempF: 165,
  maxTempF: 500,
  hopperLb: 18,
  mainGrateSqIn: 570,
  upperRackSqIn: 210,
  pelletLbPerHrLow: 1.5,
  pelletLbPerHrHigh: 3,
  preheatMin: 15,
};
const r = {};
try {
  await prefs(p, 'set', 'gear', JSON.stringify({ smoker: traeger }));
  await prefs(p, 'set', 'settings', JSON.stringify({ temp: 'F', weight: 'lb' }));
  await prefs(p, 'set', 'rates', JSON.stringify({ brisket: 0.75 }));
  await prefs(p, 'set', 'draft', JSON.stringify({ mode: 'readyBy', at: Date.parse(serve), pitTempF: 250, items: [] }));
  await prefs(p, 'remove', 'activeCook');
  await p.reload();
  await btn('Add food', false).waitFor();
  await settle();

  writeFileSync(`${out}/cook.pitplan`, JSON.stringify(file, null, 2));
  const dir = `/sdcard/Android/data/${PKG}/files`;
  adb('shell', 'mkdir', '-p', dir);
  adb('push', `${out}/cook.pitplan`, `${dir}/cook.pitplan`);
  adb(
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `file://${dir}/cook.pitplan`,
    '-t',
    'application/octet-stream',
    '-n',
    `${PKG}/io.github.mecheng70.pitplanner.MainActivity`,
  );
  await p.getByText('Open shared plan').waitFor({ timeout: 10000 });
  await settle();
  r.sheet = await measure();
  screencap(`${out}/shared.png`);
  await btn('Use this plan').click();
  await settle();
  r.draft = JSON.parse(await prefs(p, 'get', 'draft'));
  r.draft = {
    pitTempF: r.draft.pitTempF,
    at: new Date(r.draft.at).toString(),
    items: r.draft.items.map(i => `${i.foodId}/${i.methodId} ${i.quantity}`),
  };
  r.planTiles = await p.evaluate(() =>
    [...document.querySelectorAll('.tile')].map(t => t.innerText.replace(/\n+/g, ' ')),
  );
  screencap(`${out}/shared-plan.png`);

  await btn('Cook').click();
  await settle();
  // Alert permissions may be missing on the dev copy: the check sheet shows first, as with Start cook.
  if (await p.getByText('Start anyway', { exact: false }).count()) {
    r.checkSheet = true;
    await btn('Start anyway', false).click();
    await settle();
  }
  r.cook = await measure();
  r.nextTitle = await p.evaluate(() => document.querySelector('.t-nextTitle')?.innerText);
  screencap(`${out}/shared-cook.png`);
} catch (e) {
  r.error = String(e).slice(0, 300);
  screencap(`${out}/shared-error.png`);
}
try {
  await p.evaluate(() => window.Capacitor.Plugins.PitAlarms.cancelAll());
  r.alarmsCancelled = true;
} catch (e) {
  r.cancelErr = String(e).slice(0, 120);
}
writeFileSync(`${out}/shared.json`, JSON.stringify(r, null, 1));
console.log('shared', JSON.stringify(r));
await b.close();
