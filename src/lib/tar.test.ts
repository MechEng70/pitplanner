import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tar } from './tar';

const bytes = (text: string) => new Uint8Array(Buffer.from(text));
const MTIME = Date.UTC(2026, 10, 12, 22, 5);

test('the system tar lists and unpacks it: names, sizes and contents intact', () => {
  const big = new Uint8Array(1500).map((_, i) => i % 251);
  const archive = tar([
    { name: 'pitplanner.db', data: bytes('SQLite format 3\0 pretend'), mtime: MTIME },
    { name: 'pitplanner.db-wal', data: big, mtime: MTIME },
    { name: 'empty', data: new Uint8Array(0), mtime: MTIME },
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'tar-'));
  try {
    writeFileSync(join(dir, 'a.tar'), archive);
    const list = execFileSync('tar', ['-tvf', join(dir, 'a.tar')], {
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC' },
    });
    expect(
      list
        .trim()
        .split('\n')
        .map(l => l.split(/\s+/).pop()),
    ).toEqual(['pitplanner.db', 'pitplanner.db-wal', 'empty']);
    expect(list).toMatch(/-rw-------.* 1500 2026-11-12 22:05 pitplanner\.db-wal/);
    execFileSync('tar', ['-xf', join(dir, 'a.tar'), '-C', dir]);
    expect(readFileSync(join(dir, 'pitplanner.db'), 'utf8')).toBe('SQLite format 3\0 pretend');
    expect(new Uint8Array(readFileSync(join(dir, 'pitplanner.db-wal')))).toEqual(big);
    expect(readFileSync(join(dir, 'empty'))).toHaveLength(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('whole 512-byte blocks, ending with two empty ones', () => {
  const archive = tar([{ name: 'a', data: bytes('x'), mtime: MTIME }]);
  expect(archive.length).toBe(512 + 512 + 1024);
  expect(archive.slice(-1024).every(b => b === 0)).toBe(true);
  expect(tar([]).length).toBe(1024);
});

test('a name tar cannot hold is refused', () => {
  expect(() => tar([{ name: 'x'.repeat(101), data: bytes(''), mtime: MTIME }])).toThrow(/tar: name/);
  expect(() => tar([{ name: '', data: bytes(''), mtime: MTIME }])).toThrow(/tar: name/);
});
