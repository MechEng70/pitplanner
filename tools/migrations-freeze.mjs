// Migrations are frozen (Jason, 2026-11-12; CLAUDE.md): src/db/migrations/checksums.json holds the SHA-256
// of every migration file, and tools/migrations.test.mjs (npm run check, step 4) fails when one changes.
//   npm run migrations:freeze     record new migration files; never changes or removes an existing entry
// A schema change is a new migration file, never an edit to one that is recorded.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db', 'migrations');
const SUMS = 'checksums.json';
const NAME = /^(\d{4})_[a-z0-9_]+\.ts$/;

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
export const migrationFiles = dir =>
  readdirSync(dir)
    .filter(f => NAME.test(f))
    .sort();
export const readSums = dir => (existsSync(join(dir, SUMS)) ? JSON.parse(readFileSync(join(dir, SUMS), 'utf8')) : {});

/** Every problem with the migrations in `dir`, as sentences; empty when all is frozen and in order. */
export function check(dir) {
  const files = migrationFiles(dir);
  const sums = readSums(dir);
  const problems = [];
  files.forEach((f, i) => {
    const n = Number(NAME.exec(f)[1]);
    if (n !== i + 1) problems.push(`${f}: expected number ${String(i + 1).padStart(4, '0')} (no gaps, no duplicates)`);
    if (!(f in sums)) problems.push(`${f}: no checksum recorded; run npm run migrations:freeze`);
    else if (sums[f] !== sha256(join(dir, f)))
      problems.push(`${f}: changed after it was frozen. Put the file back and add a new migration instead.`);
  });
  for (const f of Object.keys(sums)) {
    if (!files.includes(f)) problems.push(`${f}: recorded but the file is gone. Migrations are never removed.`);
  }
  return problems;
}

/** Record files that have no entry yet. Returns the names added; existing entries are never touched. */
export function freeze(dir) {
  const sums = readSums(dir);
  const added = migrationFiles(dir).filter(f => !(f in sums));
  for (const f of added) sums[f] = sha256(join(dir, f));
  if (added.length > 0) {
    const sorted = Object.fromEntries(Object.entries(sums).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(join(dir, SUMS), `${JSON.stringify(sorted, null, 2)}\n`);
  }
  return added;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const added = freeze(MIGRATIONS_DIR);
  console.log(added.length > 0 ? `frozen: ${added.join(', ')}` : 'nothing new to freeze');
  const problems = check(MIGRATIONS_DIR);
  for (const p of problems) console.error(p);
  process.exit(problems.length > 0 ? 1 : 0);
}
