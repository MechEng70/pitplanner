#!/bin/bash
# Native unit tests (JUnit; Robolectric where Android classes are involved) for our Expo modules:
# modules/*/android/src/test, run through Gradle in the prebuilt android/ project.
# T-003 wires the Gradle run (and the prebuild when android/ is missing or stale). Until pit-alarms lands
# (T-013) there are no native tests on the Expo stack; the 0.2.0 Kotlin tests live in legacy/ (not built).
set -eo pipefail
cd "$(dirname "$0")/.."
shopt -s nullglob
tests=(modules/*/android/src/test)
if [ ${#tests[@]} -eq 0 ]; then
  echo "android unit tests: none yet (no modules/*/android/src/test)"
  exit 0
fi
echo "android unit tests found in ${tests[*]} but the Gradle run is not wired yet (T-003)" >&2
exit 1
