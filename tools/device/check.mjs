// Device checks over uiautomator dumps, for run.sh. Exit 0 = pass, 1 = fail (problems on stdout).
//   node check.mjs find <dump.xml> <label> <topPx> <bottomPx>       fully on screen? (exit 3: above it)
//   node check.mjs center <dump.xml> <label>                        prints "x y" of the control's center
//   node check.mjs stable <before.xml> <after.xml> <label>          T-006 stable-controls
//   node check.mjs keyboard <dump.xml> <field> <footer> <imeTop> <topPx>   T-006 sheet-keyboard
//   node check.mjs widths <dump.xml> <tolPx> <label prefix>...      T-017 PR-4: one row, equal widths
//   node check.mjs above <dump.xml> <footer> <label>...             T-017: each label ends above the footer
import { readFileSync } from 'node:fs';
import { findByLabel, fullyVisible, keyboardProblems, movedAbove, notAbove, parseDump, unequalWidths } from './ui.mjs';

const load = f => parseDump(readFileSync(f, 'utf8'));
const [cmd, ...a] = process.argv.slice(2);
let problems;
if (cmd === 'find') {
  const n = findByLabel(load(a[0]), a[1]);
  const top = Number(a[2] ?? 0);
  if (n && fullyVisible(n, top, Number(a[3] ?? Infinity))) process.exit(0);
  console.log(`"${a[1]}" is not fully on screen`);
  process.exit(n && n.b.t < top ? 3 : 1);
} else if (cmd === 'center') {
  const n = findByLabel(load(a[0]), a[1]);
  if (!n) process.exit(1);
  console.log(`${Math.round((n.b.l + n.b.r) / 2)} ${Math.round((n.b.t + n.b.b) / 2)}`);
  process.exit(0);
} else if (cmd === 'stable') {
  problems = movedAbove(load(a[0]), load(a[1]), a[2]);
} else if (cmd === 'keyboard') {
  const imeTop = a[3] === '' ? undefined : Number(a[3]);
  problems = keyboardProblems(load(a[0]), { field: a[1], footer: a[2], imeTop, topPx: Number(a[4] ?? 0) });
} else if (cmd === 'widths') {
  problems = unequalWidths(load(a[0]), a.slice(2), Number(a[1]));
} else if (cmd === 'above') {
  problems = notAbove(load(a[0]), a.slice(2), a[1]);
} else {
  console.error('usage: check.mjs find|center|stable|keyboard|widths|above ...');
  process.exit(2);
}
for (const p of problems) console.log(p);
process.exit(problems.length ? 1 : 0);
