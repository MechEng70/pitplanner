// Corner radius classes must be ones the theme defines. tailwind.config.js replaces Tailwind's radius scale
// with the design tokens (src/theme/tokens.ts `radii`), so a stock name like `rounded-2xl` compiles to
// nothing and the corner comes out square with no error.
// Regression (T-017): the selected tab's pill in the bottom nav used `rounded-2xl` and was drawn as a box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { radii } from '../src/theme/tokens.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const NAMES = new Set([...Object.keys(radii), 'none', 'full']);
const SIDES = /^(t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee)-/;

/** Every .ts/.tsx file under `dir` (tests included: a class there is copied into screens). */
function sources(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.tsx?$/.test(e.name) ? [path] : [];
  });
}

/** `rounded-*` classes in `text` that the theme does not define (arbitrary values like `rounded-[4px]` are fine). */
export function unknownRadii(text) {
  const bad = [];
  for (const [cls, rest] of text.matchAll(/\brounded-([a-zA-Z0-9[\].-]+)/g)) {
    const name = rest.replace(SIDES, '');
    if (!name.startsWith('[') && !NAMES.has(name)) bad.push(cls);
  }
  return bad;
}

test('the checker knows a theme radius from a stock Tailwind one', () => {
  assert.deepEqual(unknownRadii('h-8 rounded-control rounded-t-primary rounded-full rounded-[4px]'), []);
  assert.deepEqual(unknownRadii('h-8 w-16 rounded-2xl'), ['rounded-2xl']);
  assert.deepEqual(unknownRadii('rounded-t-lg rounded-md'), ['rounded-t-lg', 'rounded-md']);
});

test('every rounded-* class in app/ and src/ is a radius the theme defines', () => {
  const bad = [...sources('src'), ...sources('app')].flatMap(file =>
    unknownRadii(readFileSync(join(ROOT, file), 'utf8')).map(cls => `${file}: ${cls}`),
  );
  assert.deepEqual(bad, [], `not in the theme (use one of: ${[...NAMES].join(', ')})`);
});
