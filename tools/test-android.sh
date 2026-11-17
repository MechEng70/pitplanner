#!/bin/bash
# Native unit tests (JUnit; Robolectric where Android classes are involved) for our own Expo modules:
# modules/<name>/android/src/test, run as `:<gradle project>:testDebugUnitTest` in the prebuilt android/.
# Gradle project names come from Expo autolinking (it scans ./modules), so they match what prebuild links.
# Needs android/ (tools/check.sh prebuilds it when missing or stale).
set -eo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

shopt -s nullglob
test_dirs=(modules/*/android/src/test)
if [ ${#test_dirs[@]} -eq 0 ]; then
  echo "android unit tests: none yet (no modules/*/android/src/test)"
  exit 0
fi
[ -d android ] || { echo "android/ is missing: run npx expo prebuild --platform android --no-install" >&2; exit 1; }

# One "<gradle project>\t<android dir>" line per local module that autolinking links.
linked="$(npx expo-modules-autolinking resolve --platform android --json | node -e '
  const root = process.argv[1] + "/modules/";
  let s = ""; process.stdin.on("data", d => (s += d)).on("end", () => {
    for (const m of JSON.parse(s).modules)
      for (const p of m.projects ?? []) if (p.sourceDir.startsWith(root)) console.log(p.name + "\t" + p.sourceDir);
  });' "$ROOT")"

tasks=()
for dir in "${test_dirs[@]}"; do
  android_dir="$ROOT/${dir%/src/test}"
  project="$(printf '%s\n' "$linked" | awk -F'\t' -v d="$android_dir" '$2 == d { print $1 }')"
  if [ -z "$project" ]; then
    echo "$dir has tests but Expo autolinking does not link its module; check expo-module.config.json" >&2
    exit 1
  fi
  tasks+=(":$project:testDebugUnitTest")
  # ANDROID_TESTS_FORCE=1: run the tests even when Gradle would reuse the last result (--rerun is per task,
  # so only the test task runs again, not its compile steps). Used for the gate before a release build.
  [ "${ANDROID_TESTS_FORCE:-}" = 1 ] && tasks+=(--rerun)
done

echo "android unit tests: ${tasks[*]}"
stamp="$(mktemp)"
trap 'rm -f "$stamp"' EXIT
(cd android && MALLOC_ARENA_MAX=2 ./gradlew -q "${tasks[@]}")

# The count, from Gradle's own result files: per module, and whether this run executed the tests or Gradle
# reused the last result (inputs unchanged). A module with no result file, a failure or an error fails here.
total=0
line=""
for dir in "${test_dirs[@]}"; do
  module="${dir%%/android/*}"
  module="${module#modules/}"
  res="$ROOT/${dir%/src/test}/build/test-results/testDebugUnitTest"
  files=("$res"/TEST-*.xml)
  [ ${#files[@]} -gt 0 ] || { echo "android unit tests: no result files for $module in $res" >&2; exit 1; }
  read -r n bad < <(grep -ho '<testsuite [^>]*' "${files[@]}" | awk '
    { for (i = 1; i <= NF; i++) {
        if ($i ~ /^tests=/) { gsub(/[^0-9]/, "", $i); n += $i }
        if ($i ~ /^(failures|errors)=/) { gsub(/[^0-9]/, "", $i); bad += $i } } }
    END { print n + 0, bad + 0 }')
  [ "$bad" = 0 ] || { echo "android unit tests: $module has $bad failed or errored tests in $res" >&2; exit 1; }
  newest="$(ls -t "${files[@]}" | head -n 1)"
  if [ "$newest" -nt "$stamp" ]; then how="ran"; else how="up-to-date (results from $(date -r "$newest" '+%Y-%m-%d %H:%M'))"; fi
  total=$((total + n))
  line="$line${line:+, }$module $n $how"
done
echo "android unit tests: $total Kotlin tests: $line"
echo "android unit tests passed"
