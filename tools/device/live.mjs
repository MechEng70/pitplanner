// Live Cook tab test with real notifications. node live.mjs <cmd>
//   start    back up app data to out/live-backup.json, start a short cook: smoker fires in ~2 min,
//            preheat shortened to 3 min so steps come close together. Skips if a live cook has alarms.
//   state    print the Cook tab (title, chip, next up, notice), scheduled alarms and repeats.
//   click <text> [exact]   click a button by accessible name.
//   restore  cancel alarms, put the backed-up data back.
import { connect, prefs, screencap } from './phone.mjs';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const [cmd, arg, arg2] = process.argv.slice(2);
const backup = new URL('out/live-backup.json', import.meta.url).pathname;
const { b, p } = await connect();
const settle = () => p.waitForTimeout(900);
const sched = () => p.evaluate(async () => {
  const s = await window.Capacitor.Plugins.PitAlarms.getScheduled();
  const t = x => new Date(x).toLocaleTimeString();
  return { alarms: s.alarms.map(a => `${t(a.at)} ${a.title} [${a.keys?.join(',')}]${a.test ? ' (test)' : ''}`), nags: s.nags.map(n => `${n.title} ${n.count}/6 next ${t(n.nextAt)}`) };
});

if (cmd === 'start') {
  const s = await sched();
  if (s.alarms.some(a => !a.endsWith('(test)')) || s.nags.length) { console.log('live cook has alarms, skipped', s); process.exit(1); }
  const keys = await prefs(p, 'keys'); const data = {};
  for (const k of keys) data[k] = await prefs(p, 'get', k);
  if (!existsSync(backup)) writeFileSync(backup, JSON.stringify(data, null, 2));   // keep the first (real) backup
  const at = await p.evaluate(() => { const d = new Date(Date.now() + 150e3); d.setSeconds(0, 0); return d.getTime(); });
  const gear = { smoker: { id: 'pitboss-820', name: 'Pit Boss 820', type: 'pellet', tempStepF: 5, minTempF: 180, maxTempF: 500, hopperLb: 21, mainGrateSqIn: 593, upperRackSqIn: 256, pelletLbPerHrLow: 1.5, pelletLbPerHrHigh: 3, preheatMin: 3 },
    griddle: { id: 'griddle', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: false, preheatMin: 3 } };
  const items = [{ id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 }];
  await prefs(p, 'remove', 'activeCook');
  await prefs(p, 'set', 'gear', JSON.stringify(gear));
  await prefs(p, 'set', 'draft', JSON.stringify({ mode: 'startAt', at, pitTempF: 225, items }));
  await p.reload(); await p.getByText('On the menu').waitFor(); await settle();
  await p.getByRole('button', { name: 'Start cook' }).click(); await settle();
  const anyway = p.getByRole('button', { name: 'Start anyway' });
  if (await anyway.count()) { console.log('alert permissions missing'); await anyway.click(); await settle(); }
  console.log(await sched());
} else if (cmd === 'state') {
  console.log(await p.evaluate(() => {
    const t = s => document.querySelector(s)?.textContent;
    return { title: t('.appbar h1'), sub: t('.appbar .t-subtitle') ?? null, chip: t('.status-chip'), next: t('.t-nextTitle'), countdown: t('.t-countdown'),
      banners: [...document.querySelectorAll('.banner')].map(e => e.textContent) };
  }));
  console.log(await prefs(p, 'get', 'activeCook').then(v => { const c = JSON.parse(v ?? 'null'); return c && { notice: c.notice, done: c.done, reminders: c.reminders, pitDownAt: c.pitDownAt, quietUntil: c.quietUntil }; }));
  console.log(await sched());
} else if (cmd === 'click') {
  await p.getByRole('button', { name: arg, exact: arg2 === 'exact' }).first().click(); await settle();
  console.log('clicked', arg);
} else if (cmd === 'shot') {
  screencap(arg);
} else if (cmd === 'restore') {
  await p.evaluate(() => window.Capacitor.Plugins.PitAlarms.cancelAll());
  const data = JSON.parse(readFileSync(backup, 'utf8'));
  for (const k of await prefs(p, 'keys')) if (!(k in data)) await prefs(p, 'remove', k);
  for (const [k, v] of Object.entries(data)) await prefs(p, 'set', k, v);
  await p.reload();
  console.log('restored', Object.keys(data));
  if (arg === 'final') unlinkSync(backup);
}
await b.close();
