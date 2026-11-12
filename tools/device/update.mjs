// node update.mjs <outdir>: Gear shows "Update available" when the stored check found a newer release.
// Stores a fake check (today, v9.9.0) so no network is needed; run.sh restores the data.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const r = {};
try {
  await prefs(p, 'remove', 'activeCook');
  await p.waitForTimeout(4000); // let the app's own launch check finish so it can't overwrite the fake one
  await prefs(p, 'set', 'update', JSON.stringify({ checkedAt: Date.now(), latest: 'v9.9.0', url: 'https://github.com/MechEng70/pitplanner/releases/latest' }));
  await p.reload();
  const gear = p.getByRole('button', { name: 'Gear', exact: true }).first();
  await gear.waitFor(); await gear.click(); await p.waitForTimeout(900);
  const row = p.getByText('Update available');
  await row.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  r.row = await p.evaluate(() => [...document.querySelectorAll('.list-row')].map(x => x.innerText.replace(/\n+/g, ' | ')).find(t => t.includes('Update')));
  r.href = await p.evaluate(() => [...document.querySelectorAll('a.list-row, .list-row a, a')].map(a => a.href).find(h => h.includes('releases')));
  screencap(`${out}/update.png`);
} catch (e) { r.error = String(e).slice(0, 300); }
writeFileSync(`${out}/update.json`, JSON.stringify(r, null, 1));
console.log('update', JSON.stringify(r));
await b.close();
