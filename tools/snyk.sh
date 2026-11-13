#!/bin/bash
# Snyk as the gate runs it (check step 6). Snyk reads the token and org from the user's own `snyk config`.
# Fails on high/critical findings, and also when Snyk skips a project or tests fewer projects than exist
# (it exits 0 in that case: "1/24 potential projects failed to get dependencies", 2026-11-12). Expected
# projects: every package-lock.json outside excluded and node_modules folders, plus every Gradle project of the
# generated android/ (`gradlew projects`). A server or network error is retried once (run_snyk below).
# SNYK_BIN and SNYK_ROOT let tools/snyk.test.mjs run this against a fake snyk and a fake project.
set -uo pipefail
ROOT="${SNYK_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
TOOLS="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1
SNYK="${SNYK_BIN:-snyk}"
command -v "$SNYK" >/dev/null || { echo "snyk not found (npm i -g snyk, then snyk auth)"; exit 2; }
EXCLUDE=reference,release,legacy,docs,modules
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT # the temp dir made above, nothing else

# Expected projects.
prune=(-name node_modules)
IFS=, read -ra excluded <<<"$EXCLUDE"
for d in "${excluded[@]}"; do prune+=(-o -path "./$d"); done
find . \( "${prune[@]}" \) -prune -o -name package-lock.json -print | sed 's|^\./|npm |' >"$TMP/expected"
if [ -x android/gradlew ]; then
  (cd android && ./gradlew -q projects 2>/dev/null) |
    sed -n "s/^Root project .*/gradle :/p; s/.*Project '\(:[^']*\)'.*/gradle \1/p" | sort -u >>"$TMP/expected"
fi

# Run snyk with the given arguments, output to the terminal and to the log file $1. A server or network
# error (HTTP 5xx, a timeout, a dropped connection) is retried once (Jason, 2026-11-13: a 504 from Snyk failed
# the gate). Findings are never retried: Snyk exits 1 for those, and only other failures whose output names
# such an error get the second try.
TRANSIENT='Status:[[:space:]]+5[0-9][0-9]|HTTP[^[:alnum:]]*5[0-9][0-9]|Gateway Time-?out|Bad Gateway|Service Unavailable|Internal Server Error|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|timed out|timeout'
run_snyk() {
  local log="$1" rc
  shift
  "$SNYK" "$@" 2>&1 | tee "$log"
  rc=${PIPESTATUS[0]}
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 1 ] && grep -qiE "$TRANSIENT" "$log"; then
    echo "Snyk server or network error (exit $rc): trying once more in ${SNYK_RETRY_WAIT:-15} s"
    sleep "${SNYK_RETRY_WAIT:-15}"
    "$SNYK" "$@" 2>&1 | tee "$log"
    rc=${PIPESTATUS[0]}
  fi
  return "$rc"
}

# Gradle: only what ships in the APK (releaseRuntimeClasspath). Build-machine tooling findings
# (AGP test runner) are tracked in docs/design/SECURITY-EXCEPTIONS.md, SE-001.
# modules/: our Expo modules' build.gradle files are not standalone Gradle projects (no wrapper); their
# dependencies are scanned as subprojects of the generated android/ (for example "Pit Planner dev/pit-alarms").
run_snyk "$TMP/test.log" test --all-projects --severity-threshold=high --exclude="$EXCLUDE" \
  --configuration-matching='^releaseRuntimeClasspath$' --json-file-output="$TMP/test.json"
rc=$?
[ "$rc" -eq 0 ] || exit "$rc"
node "$TOOLS/snyk-coverage.mjs" "$TMP/test.log" "$TMP/test.json" "$TMP/expected" || exit 1
run_snyk "$TMP/code.log" code test --severity-threshold=high
