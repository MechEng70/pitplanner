// node alarmcall.mjs <method> '<json args>'  -> call PitAlarms on the phone, print the result
import { connect } from './phone.mjs';
const [method, args] = process.argv.slice(2);
const { b, p } = await connect();
const r = await p.evaluate(([m, a]) => window.Capacitor.Plugins.PitAlarms[m](a ? JSON.parse(a) : undefined), [method, args ?? '']);
console.log(JSON.stringify(r ?? null));
await b.close();
