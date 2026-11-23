#!/bin/bash
# Quality gate: npm run check. Runs the six steps in order and stops at the first failure.
# A task is not done until this passes (CLAUDE.md, "Quality gate").
# Snyk reads the token and org from the user's own `snyk config`; nothing secret lives in the repo.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

# The dashboard (scripts/dashboard.py) reads the last run: build/gate/last.tsv (one line per step: name, PASS or
# FAIL, seconds; then "finished" and the time) and build/gate/last.log (the whole output, for the test counts).
# Both are git-ignored. The run's output still goes to the terminal as before.
GATE="$ROOT/build/gate"
mkdir -p "$GATE"
: >"$GATE/last.tsv.part"
exec > >(tee "$GATE/last.log") 2>&1

SUMMARY=()
step() {
  local name="$1"; shift
  local t0=$SECONDS
  echo; echo "=== $name ==="
  if "$@"; then
    SUMMARY+=("PASS  $name ($((SECONDS - t0))s)")
    printf '%s\tPASS\t%s\n' "$name" "$((SECONDS - t0))" >>"$GATE/last.tsv.part"
  else
    SUMMARY+=("FAIL  $name ($((SECONDS - t0))s)")
    printf '%s\tFAIL\t%s\n' "$name" "$((SECONDS - t0))" >>"$GATE/last.tsv.part"
    report; exit 1
  fi
}
report() {
  echo; echo "=== check summary ==="; printf '%s\n' "${SUMMARY[@]}"
  printf 'finished\t%s\n' "$(date -Iseconds)" >>"$GATE/last.tsv.part"
  mv -f "$GATE/last.tsv.part" "$GATE/last.tsv"
}


step "1 Prettier (write, then check)" bash -c 'npx prettier --write --log-level warn . && npx prettier --check --log-level warn .'
step "2 ESLint (zero warnings)" npx eslint --max-warnings 0 .
step "3 TypeScript typecheck" npm run --silent typecheck
# Not a gate step: steps 4 and 6 need the generated android/ (native tests, Snyk's Gradle scan).
tools/prebuild-if-stale.sh || { SUMMARY+=("FAIL  prebuild android/"); printf 'prebuild android/\tFAIL\t0\n' >>"$GATE/last.tsv.part"; report; exit 1; }
step "4 Tests (engine, gate, app, Android)" npm run --silent test:all
step "5 Semgrep (typescript, kotlin, secrets)" tools/semgrep.sh
step "6 Snyk (open source + code, high+)" tools/snyk.sh
report
