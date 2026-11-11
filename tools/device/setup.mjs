// node setup.mjs <outdir>: first-launch Setup (mockups 01-03). Removes the saved gear so Setup shows,
// walks Welcome -> cookers (picker, verified pick, unverified form, Add a cooker) -> alerts -> Finish,
// and checks gear was saved. run.sh restores the real data afterwards.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const settle = () => p.waitForTimeout(900);
const btn = (name, exact = true) => p.getByRole('button', { name, exact }).first();
// Rows under the pinned footer count as "in view" for Playwright: center them like a user would scroll.
const tap = async l => { await l.evaluate(e => e.scrollIntoView({ block: 'center' })); await l.click(); };
const measure = () => p.evaluate(() => {
  const nums = [...document.querySelectorAll('.num, input')];
  const clipped = nums.filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth).map(n => n.textContent || n.value);
  const title = document.querySelector('.overlay-screen h1')?.textContent ?? document.querySelector('.sheet .t-sheetTitle')?.textContent;
  return { title, clipped, wide: document.documentElement.scrollWidth > innerWidth };
});
const live = await p.evaluate(async () => { const s = await window.Capacitor.Plugins.PitAlarms.getScheduled(); return s.alarms.some(a => !a.test) || s.nags.length > 0; });
if (live) { console.log('setup: a live cook has alarms set on the phone, skipped'); await b.close(); process.exit(0); }

const r = {};
try {
  await prefs(p, 'remove', 'gear'); await prefs(p, 'remove', 'activeCook');
  await p.reload(); await p.getByText('Welcome to Pit Planner').waitFor(); await settle();
  r.welcome = await measure(); screencap(`${out}/setup1.png`);
  await btn('Continue').click(); await settle();
  r.empty = await measure(); r.emptyContinueDisabled = await btn('Continue').isDisabled();
  screencap(`${out}/setup2-empty.png`);
  await p.getByRole('checkbox', { name: /Smoker/ }).click(); await settle();
  r.picker = await measure(); screencap(`${out}/setup-picker.png`);
  await p.getByRole('option', { name: 'Pit Boss 820' }).click(); await settle();
  await tap(p.getByRole('checkbox', { name: /Griddle/ })); await settle();
  r.cookers = await measure();
  r.fields = await p.evaluate(() => [...document.querySelectorAll('.option-body input')].map(i => i.value));
  screencap(`${out}/setup2.png`);
  await tap(btn('Add another cooker')); await settle();
  r.add = await p.evaluate(() => [...document.querySelectorAll('.sheet .card')].map(c => c.getAttribute('aria-label')));
  screencap(`${out}/setup-add.png`);
  await btn('Smoker').click(); await settle();
  await p.getByRole('option', { name: 'Weber Searwood' }).click(); await settle();
  r.form = await measure(); r.formSaveDisabled = await btn('Save smoker').isDisabled();
  screencap(`${out}/setup-form.png`);
  await btn('Close').click(); await settle();
  await btn('Continue').click(); await settle();
  r.alerts = await measure(); screencap(`${out}/setup3.png`);
  await btn('Finish setup').click(); await settle();
  r.saved = JSON.parse(await prefs(p, 'get', 'gear'));
  r.saved = { smoker: r.saved.smoker?.name, griddle: !!r.saved.griddle, oven: !!r.saved.oven };
  r.after = await p.evaluate(() => document.querySelector('.appbar h1')?.textContent);
} catch (e) { r.error = String(e).slice(0, 300); screencap(`${out}/setup-error.png`); }
writeFileSync(`${out}/setup.json`, JSON.stringify(r, null, 1));
console.log('setup', JSON.stringify(r));
await b.close();
