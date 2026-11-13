// Pure helpers over `uiautomator dump` XML for the device checks (no adb here, so they are unit tested in
// ui.test.mjs). Bounds are screen pixels. Nodes are identified by their tree path ("0/2/1"), so a node whose
// text changes (a stepper value) is still the same node.

const ATTR = /([\w-]+)="([^"]*)"/g;
const unescape = s =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** Every <node> in document order: { path, cls, text, desc, focused, clickable, b: { l, t, r, b } }. */
export function parseDump(xml) {
  const nodes = [];
  const open = [{ path: '', kids: 0 }]; // the root and every unclosed <node>
  for (const m of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node>/g)) {
    if (m[0] === '</node>') {
      open.pop();
      continue;
    }
    const a = {};
    for (const [, k, v] of m[1].matchAll(ATTR)) a[k] = unescape(v);
    const parent = open[open.length - 1];
    const path = parent.path ? `${parent.path}/${parent.kids}` : `${parent.kids}`;
    parent.kids++;
    const [l, t, r, b] = (a.bounds ?? '[0,0][0,0]').match(/-?\d+/g).map(Number);
    nodes.push({
      path,
      cls: a.class ?? '',
      text: a.text ?? '',
      desc: a['content-desc'] ?? '',
      focused: a.focused === 'true',
      clickable: a.clickable === 'true',
      b: { l, t, r, b },
    });
    if (m[2] !== '/') open.push({ path, kids: 0 });
  }
  return nodes;
}

const fmt = b => `[${b.l},${b.t}][${b.r},${b.b}]`;

/**
 * The node a person taps for `label`: its accessibility label or text. Prefers a clickable node or a text
 * field (the label TextView above an input has the same text).
 */
export function findByLabel(nodes, label) {
  const hits = nodes.filter(n => n.desc === label || n.text === label);
  return hits.find(n => n.clickable || /EditText/.test(n.cls)) ?? hits[0] ?? null;
}

/** The element whose accessibility label starts with `prefix` (a tile is labelled "Fire smoker 6:20 AM"). */
export const findByPrefix = (nodes, prefix) => nodes.find(n => n.desc.startsWith(prefix)) ?? null;

/**
 * T-017 PR-4: the elements labelled `prefixes` share one row in equal parts. Problems as lines: one missing,
 * not on the same row (tops differ), or any two widths more than `tolPx` apart.
 */
export function unequalWidths(nodes, prefixes, tolPx) {
  const found = prefixes.map(p => ({ p, n: findByPrefix(nodes, p) }));
  const problems = found.filter(f => !f.n).map(f => `"${f.p}" is not on screen`);
  const on = found.filter(f => f.n);
  if (on.length < 2) return problems;
  const width = f => f.n.b.r - f.n.b.l;
  const widths = on.map(width);
  if (Math.max(...widths) - Math.min(...widths) > tolPx)
    problems.push(`widths differ: ${on.map(f => `${f.p} ${width(f)} px`).join(', ')}`);
  if (new Set(on.map(f => f.n.b.t)).size > 1)
    problems.push(`not on one row: ${on.map(f => `${f.p} top ${f.n.b.t}`).join(', ')}`);
  return problems;
}

/**
 * T-017 acceptance: each of `labels` ends at or above the top of the pinned `footer` control, i.e. it can be
 * read and tapped without scrolling. Problems as lines.
 */
export function notAbove(nodes, labels, footer) {
  const foot = findByLabel(nodes, footer);
  if (!foot) return [`"${footer}" is not on screen`];
  return labels.flatMap(label => {
    const n = findByLabel(nodes, label);
    if (!n) return [`"${label}" is not on screen`];
    return n.b.b <= foot.b.t ? [] : [`"${label}" ends at ${n.b.b} px, below the top of "${footer}" (${foot.b.t} px)`];
  });
}

/** On screen and not cut by `bottomPx` (the keyboard's top or the screen's height). */
export const fullyVisible = (n, topPx, bottomPx) => n.b.t >= topPx && n.b.b <= bottomPx && n.b.b > n.b.t;

/**
 * T-006 `stable-controls`: what moved between two dumps taken before and after tapping `label`. Checked: the
 * control, its row and everything above it, i.e. every node that starts above the control's bottom edge (top,
 * left and right edges; the bottom edge too when the node ends within the control's bottom, so a container
 * may grow downward). Also reports such nodes that disappeared or appeared. Returns human-readable lines;
 * empty means nothing moved.
 */
export function movedAbove(before, after, label) {
  const ctl = findByLabel(before, label);
  if (!ctl) return [`"${label}" is not on screen`];
  const name = n => n.desc || n.text || n.cls.split('.').pop();
  // Labeled nodes match by class and label when that is unique on both screens (nodes scrolled off the top
  // leave the tree, so paths shift); the rest, like a value whose text changed, match by path and class.
  const key = n => (n.desc || n.text ? `${n.cls}|${n.desc}|${n.text}` : null);
  const count = list => list.reduce((m, n) => (key(n) ? m.set(key(n), (m.get(key(n)) ?? 0) + 1) : m), new Map());
  const [inBefore, inAfter] = [count(before), count(after)];
  const byKey = new Map(after.filter(n => key(n) && inAfter.get(key(n)) === 1).map(n => [key(n), n]));
  const byPath = new Map(after.map(n => [n.path, n]));
  const matchOf = n => {
    const k = key(n);
    if (k && inBefore.get(k) === 1 && byKey.has(k)) return byKey.get(k);
    const m = byPath.get(n.path);
    // Not a node that is already some other labeled node's match.
    const taken = m && key(m) && inBefore.get(key(m)) === 1 && byKey.get(key(m)) === m;
    return m && m.cls === n.cls && !taken ? m : undefined;
  };
  const out = [];
  const matched = new Set();
  let unlabeled = 0;
  for (const n of before) {
    if (n.b.t >= ctl.b.b) continue;
    const m = matchOf(n);
    if (!m) {
      if (key(n)) out.push(`gone: ${name(n)} ${fmt(n.b)}`);
      continue;
    }
    matched.add(m);
    const edges = ['t', 'l', 'r'];
    if (n.b.b <= ctl.b.b) edges.push('b');
    if (!edges.some(e => n.b[e] !== m.b[e])) continue;
    if (key(n)) out.push(`moved: ${name(n)} ${fmt(n.b)} -> ${fmt(m.b)}`);
    else unlabeled++;
  }
  if (unlabeled) out.push(`moved: ${unlabeled} unlabeled view(s)`);
  for (const m of after) if (!matched.has(m) && key(m) && m.b.t < ctl.b.b) out.push(`new: ${name(m)} ${fmt(m.b)}`);
  return out;
}

/**
 * T-006 `sheet-keyboard`: with the keyboard open, the focused field is `field`, it is fully above the keyboard
 * and above the footer button `footer`, and the footer is fully above the keyboard. Returns problems.
 */
export function keyboardProblems(nodes, { field, footer, imeTop, topPx = 0 }) {
  if (imeTop == null || Number.isNaN(imeTop)) return ['the keyboard is not open'];
  const out = [];
  const f = nodes.find(n => n.focused && /EditText/.test(n.cls));
  if (!f) out.push('no focused text field');
  else if (f.desc !== field) out.push(`focused field is "${f.desc}", expected "${field}"`);
  const btn = findByLabel(nodes, footer);
  if (!btn) out.push(`footer "${footer}" is not on screen`);
  else if (!fullyVisible(btn, topPx, imeTop))
    out.push(`footer "${footer}" ${fmt(btn.b)} is under the keyboard (top ${imeTop})`);
  if (f && f.desc === field) {
    const limit = btn ? Math.min(btn.b.t, imeTop) : imeTop;
    if (!fullyVisible(f, topPx, limit))
      out.push(`field "${field}" ${fmt(f.b)} is hidden (visible area ends at ${limit})`);
  }
  return out;
}
