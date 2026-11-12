// Checks that `snyk test --all-projects` covered every project (called by tools/snyk.sh).
// Usage: node snyk-coverage.mjs <snyk stdout log> <snyk --json-file-output> <expected projects file>
// Expected file: one line per project, "npm <lockfile path>" or "gradle <:project path>" ('' root is ":").
// Fails when Snyk says it skipped a project ("N/M potential projects failed") or a project is missing.
import { readFileSync } from 'node:fs';

const [logPath, jsonPath, expectedPath] = process.argv.slice(2);
const log = readFileSync(logPath, 'utf8');
const problems = [];

const skipped = /(\d+)\/(\d+) potential projects failed/.exec(log);
if (skipped) problems.push(`Snyk skipped ${skipped[1]} of ${skipped[2]} projects ("failed to get dependencies")`);

let results = [];
try {
  const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
  results = Array.isArray(json) ? json : [json];
} catch (e) {
  problems.push(`no readable Snyk JSON output (${e.message})`);
}
const npmTested = new Set(results.filter(r => r.packageManager === 'npm').map(r => r.displayTargetFile));
const gradleTested = new Set(
  results.filter(r => r.packageManager === 'gradle').map(r => String(r.projectName).split('/').slice(1).join(':')),
);

const expected = readFileSync(expectedPath, 'utf8').split('\n').filter(Boolean);
for (const line of expected) {
  const [kind, id] = line.split(' ');
  if (kind === 'npm' && !npmTested.has(id)) problems.push(`npm project ${id} was not tested`);
  if (kind === 'gradle' && !gradleTested.has(id.replace(/^:/, '')))
    problems.push(`Gradle project ${id} was not tested`);
}

if (problems.length) {
  console.error(`Snyk coverage: FAIL (${results.length} tested, ${expected.length} expected)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`Snyk coverage: all ${expected.length} projects tested, none skipped`);
