import { connect, prefs } from './phone.mjs';
import { writeFileSync } from 'node:fs';
const { b, p } = await connect();
const keys = await prefs(p, 'keys');
const out = {};
for (const k of keys) out[k] = await prefs(p, 'get', k);
writeFileSync(
  `${process.argv[2] ?? new URL('out/prefs-backup.json', import.meta.url).pathname}`,
  JSON.stringify(out, null, 2),
);
console.log(Object.keys(out), JSON.stringify(out).slice(0, 600));
await b.close();
