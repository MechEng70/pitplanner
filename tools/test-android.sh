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
done

echo "android unit tests: ${tasks[*]}"
(cd android && ./gradlew -q "${tasks[@]}")
echo "android unit tests passed"
