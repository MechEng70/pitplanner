#!/bin/bash
# Quality gate: npm run check. Runs the six steps in order and stops at the first failure.
# A task is not done until this passes (CLAUDE.md, "Quality gate").
# Snyk reads the token and org from the user's own `snyk config`; nothing secret lives in the repo.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

SUMMARY=()
step() {
  local name="$1"; shift
  local t0=$SECONDS
  echo; echo "=== $name ==="
  if "$@"; then
    SUMMARY+=("PASS  $name ($((SECONDS - t0))s)")
  else
    SUMMARY+=("FAIL  $name ($((SECONDS - t0))s)")
    report; exit 1
  fi
}
report() { echo; echo "=== check summary ==="; printf '%s\n' "${SUMMARY[@]}"; }

snyk_scan() {
  command -v snyk >/dev/null || { echo "snyk not found (npm i -g snyk, then snyk auth)"; return 1; }
  # Gradle: only what ships in the APK (releaseRuntimeClasspath). Build-machine tooling findings
  # (AGP test runner) are tracked in docs/design/SECURITY-EXCEPTIONS.md, SE-001.
  # modules/: our Expo modules' build.gradle files are not standalone Gradle projects (no wrapper); their
  # dependencies are scanned as subprojects of the generated android/ (for example "Pit Planner dev/pit-alarms").
  snyk test --all-projects --severity-threshold=high --exclude=reference,release,legacy,docs,modules \
    --configuration-matching='^releaseRuntimeClasspath$' \
    && snyk code test --severity-threshold=high
}

step "1 Prettier (write, then check)" bash -c 'npx prettier --write --log-level warn . && npx prettier --check --log-level warn .'
step "2 ESLint (zero warnings)" npx eslint --max-warnings 0 .
step "3 TypeScript typecheck" npm run --silent typecheck
# Not a gate step: steps 4 and 6 need the generated android/ (native tests, Snyk's Gradle scan).
tools/prebuild-if-stale.sh || { SUMMARY+=("FAIL  prebuild android/"); report; exit 1; }
step "4 Tests (engine, gate, app, Android)" npm run --silent test:all
step "5 Semgrep (typescript, kotlin, secrets)" tools/semgrep.sh
step "6 Snyk (open source + code, high+)" snyk_scan
report
