// Gate: migrations are frozen (CLAUDE.md). Editing, removing or renumbering a recorded migration fails here.
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { check, freeze, MIGRATIONS_DIR, migrationFiles, readSums } from './migrations-freeze.mjs';

test('every migration in src/db/migrations matches its recorded checksum', () => {
  assert.ok(migrationFiles(MIGRATIONS_DIR).length >= 1);
  assert.deepEqual(check(MIGRATIONS_DIR), []);
});

test('index.ts lists every migration file', () => {
  const index = readFileSync(join(MIGRATIONS_DIR, 'index.ts'), 'utf8');
  for (const f of migrationFiles(MIGRATIONS_DIR)) assert.match(index, new RegExp(`'\\./${f}'`), `${f} not imported`);
});

// Self-test on a copy: the check must catch each way a frozen migration can be broken.
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  writeFileSync(join(dir, '0001_init.ts'), 'export const init = 1;\n');
  writeFileSync(join(dir, '0002_more.ts'), 'export const more = 2;\n');
  assert.deepEqual(freeze(dir), ['0001_init.ts', '0002_more.ts']);
  assert.deepEqual(check(dir), []);
  return dir;
}

test('editing a frozen migration fails, and freezing again does not accept the edit', () => {
  const dir = sandbox();
  appendFileSync(join(dir, '0001_init.ts'), '// one more column\n');
  assert.match(check(dir).join('\n'), /0001_init\.ts: changed after it was frozen/);
  const before = readSums(dir);
  assert.deepEqual(freeze(dir), []);
  assert.deepEqual(readSums(dir), before);
  assert.equal(check(dir).length, 1);
  rmSync(dir, { recursive: true });
});

test('a new migration fails until it is frozen; freezing records only the new file', () => {
  const dir = sandbox();
  writeFileSync(join(dir, '0003_next.ts'), 'export const next = 3;\n');
  assert.match(check(dir).join('\n'), /0003_next\.ts: no checksum recorded/);
  const before = readSums(dir);
  assert.deepEqual(freeze(dir), ['0003_next.ts']);
  assert.deepEqual(check(dir), []);
  assert.equal(readSums(dir)['0001_init.ts'], before['0001_init.ts']);
  rmSync(dir, { recursive: true });
});

test('removing a migration or leaving a gap in the numbers fails', () => {
  const dir = sandbox();
  rmSync(join(dir, '0002_more.ts'));
  assert.match(check(dir).join('\n'), /0002_more\.ts: recorded but the file is gone/);
  writeFileSync(join(dir, '0004_gap.ts'), 'export const gap = 4;\n');
  assert.match(check(dir).join('\n'), /0004_gap\.ts: expected number 0002/);
  rmSync(dir, { recursive: true });
});
