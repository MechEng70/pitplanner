// The quality gate tests itself (T-003): ESLint enforces the layer rules of TECH-DESIGN section 3 and the
// theme rules, and Semgrep fails on planted secrets. Runs under node --test (npm run test:gate).
// ESLint is fed virtual files (lintText with a filePath), so nothing is written into the repo; the planted
// secrets go to a temp dir outside it and are built at runtime, so no file here holds one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ESLint } from 'eslint';

const ROOT = new URL('..', import.meta.url).pathname;
const eslint = new ESLint({ cwd: ROOT });

/** Rule IDs ESLint reports for `code` as if it lived at `path` (repo-relative). */
async function ruleIds(path, code) {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, path) });
  return result.messages.map(m => m.ruleId);
}

const LAYER = 'no-restricted-imports';
const cases = [
  // [path, code, rule expected (or null: that rule must not fire), what it proves]
  [
    'engine/probe.ts',
    "import { View } from 'react-native';\nexport const v = View;\n",
    LAYER,
    'engine: no React Native',
  ],
  ['engine/probe.ts', "import * as F from 'expo-file-system';\nexport const f = F;\n", LAYER, 'engine: no Expo'],
  [
    'engine/probe.ts',
    "import { fmtTime } from '../src/lib/format.ts';\nexport const f = fmtTime;\n",
    LAYER,
    'engine: imports only engine/*',
  ],
  [
    'engine/probe.ts',
    "import { readFileSync } from 'node:fs';\nexport const r = readFileSync;\n",
    LAYER,
    'engine: no storage',
  ],
  ['engine/probe.ts', 'export const now = () => Date.now();\n', 'no-restricted-syntax', 'engine: no clock'],
  [
    'engine/probe.ts',
    'export const now = () => new Date();\n',
    'no-restricted-syntax',
    'engine: no clock (new Date())',
  ],
  ['engine/probe.ts', "export const get = () => fetch('x');\n", 'no-restricted-globals', 'engine: no network'],
  ['engine/probe.ts', 'export const at = (ms: number) => new Date(ms);\n', null, 'engine: new Date(ms) is fine'],
  [
    'engine/probe.test.ts',
    "import { fmtTime } from '../src/lib/format.ts';\nexport const f = fmtTime;\n",
    null,
    'engine tests may import src/lib (rule 3)',
  ],
  [
    'src/lib/probe.ts',
    "import { Text } from 'react-native';\nexport const t = Text;\n",
    LAYER,
    'src/lib: no React Native',
  ],
  [
    'src/lib/probe.ts',
    "import * as S from 'expo-secure-store';\nexport const s = S;\n",
    LAYER,
    'src/lib: no expo-* directly',
  ],
  [
    'src/lib/probe.ts',
    "import { PlanPlaceholder } from '../screens/plan/PlanPlaceholder';\nexport const p = PlanPlaceholder;\n",
    LAYER,
    'src/lib: no screens',
  ],
  [
    'src/lib/probe.ts',
    "import { PitAlarms } from '../platform/alarms.ts';\nexport const p = PitAlarms;\n",
    LAYER,
    'src/lib: no platform implementations',
  ],
  [
    'src/lib/probe.ts',
    "import type { AlarmService } from '../platform/types.ts';\nexport type A = AlarmService;\n",
    null,
    'src/lib: platform interfaces are fine',
  ],
  [
    'src/lib/probe.ts',
    "import { useState } from 'react';\nexport const u = useState;\n",
    null,
    'src/lib: React (the store context) is fine',
  ],
  [
    'src/db/probe.ts',
    "import * as SQLite from 'expo-sqlite';\nexport const s = SQLite;\n",
    LAYER,
    'src/db: expo-sqlite only in expoDb.ts',
  ],
  [
    'src/db/expoDb.ts',
    "import * as SQLite from 'expo-sqlite';\nexport const s = SQLite;\n",
    null,
    'src/db/expoDb.ts may import expo-sqlite',
  ],
  [
    'src/platform/probe.ts',
    "import { PlanPlaceholder } from '../screens/plan/PlanPlaceholder';\nexport const p = PlanPlaceholder;\n",
    LAYER,
    'src/platform: no screens',
  ],
  ['app/probe.tsx', "import * as SQLite from 'expo-sqlite';\nexport const s = SQLite;\n", LAYER, 'UI: no expo-sqlite'],
  [
    'src/screens/probe.tsx',
    "import { PitAlarms } from '../../modules/pit-alarms';\nexport const p = PitAlarms;\n",
    LAYER,
    'UI: no native modules',
  ],
  [
    'src/screens/probe.tsx',
    "import { Text } from 'react-native';\nexport const P = () => <Text style={{ color: '#ff8f4a' }}>Hi</Text>;\n",
    'react-native/no-color-literals',
    'UI: theme tokens only, no color literals',
  ],
  [
    'src/screens/probe.tsx',
    "import { View } from 'react-native';\nexport const P = () => <View style={{ padding: 4 }} />;\n",
    'react-native/no-inline-styles',
    'UI: no inline styles',
  ],
  [
    'src/screens/probe.tsx',
    "import { useState } from 'react';\nexport function P({ on }: { on: boolean }) {\n  if (on) useState(0);\n  return null;\n}\n",
    'react-hooks/rules-of-hooks',
    'React Hooks rules',
  ],
  [
    'src/screens/probe.tsx',
    "import { Num } from '@/components/kit';\nexport const P = () => <Num numberOfLines={1}>6:20 AM</Num>;\n",
    'pitplanner/num-text-size',
    'UI: a Num never truncates (font scale rule)',
  ],
  ['src/lib/probe.ts', 'const unused = 1;\nexport {};\n', '@typescript-eslint/no-unused-vars', 'a plain lint error'],
];

for (const [path, code, rule, what] of cases) {
  test(`eslint: ${what} (${path})`, async () => {
    const ids = await ruleIds(path, code);
    if (rule) assert.ok(ids.includes(rule), `expected ${rule}, got ${JSON.stringify(ids)}`);
    else
      assert.ok(
        !ids.includes(LAYER) && !ids.includes('no-restricted-syntax'),
        `layer rule fired: ${JSON.stringify(ids)}`,
      );
  });
}

test('eslint: lint errors fail `eslint --max-warnings 0` (exit code 1)', () => {
  const r = spawnSync('npx', ['eslint', '--max-warnings', '0', '--stdin', '--stdin-filename', 'src/lib/probe.ts'], {
    cwd: ROOT,
    input: 'const unused = 1;\nexport {};\n',
    encoding: 'utf8',
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
});

test('semgrep: planted secrets fail the gate (tools/semgrep.sh exits 1 and names each one)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitplanner-gate-'));
  try {
    const hex = n => randomBytes(n).toString('hex');
    // Built at runtime from split prefixes, so this file never contains a token.
    writeFileSync(join(dir, 'stripe.ts'), `export const key = '${'sk_' + 'live_' + hex(12)}';\n`);
    writeFileSync(join(dir, 'github.ts'), `export const token = '${'gh' + 'p_' + hex(18)}';\n`);
    // Shaped like a real RSA key: the DER header run `MIIEowIBAAKCAQEA`, then 64-character lines. The rule
    // measures the entropy of the first word after BEGIN, so a random start like `a/...` is not always caught.
    const body = ('MIIEowIBAAKCAQEA' + randomBytes(180).toString('base64')).match(/.{1,64}/g).join('\n');
    const pem = `-----BEGIN ${'RSA PRIVATE'} KEY-----\n${body}\n-----END RSA PRIVATE KEY-----\n`;
    writeFileSync(join(dir, 'key.pem'), pem);
    const r = spawnSync(join(ROOT, 'tools/semgrep.sh'), ['--json', dir], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 1, `semgrep exit ${r.status}: ${r.stderr}`);
    const found = JSON.parse(r.stdout).results.map(x => `${x.path.split('/').pop()}:${x.check_id.split('.').pop()}`);
    for (const want of [
      'stripe.ts:detected-stripe-api-key',
      'github.ts:detected-github-token',
      'key.pem:detected-private-key',
    ])
      assert.ok(found.includes(want), `missing ${want} in ${JSON.stringify(found)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true }); // only the temp dir this test created
  }
});
