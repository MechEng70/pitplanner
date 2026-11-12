import { connect, prefs } from './phone.mjs';
import { readFileSync } from 'node:fs';
const { b, p } = await connect();
const data = JSON.parse(
  readFileSync(`${process.argv[2] ?? new URL('out/prefs-backup.json', import.meta.url).pathname}`, 'utf8'),
);
for (const k of await prefs(p, 'keys')) if (!(k in data)) await prefs(p, 'remove', k);
for (const [k, v] of Object.entries(data)) await prefs(p, 'set', k, v);
await p.reload();
console.log('restored', await prefs(p, 'keys'));
await b.close();
