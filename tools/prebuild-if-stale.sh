#!/bin/bash
# Generate android/ (Continuous Native Generation, TECH-DESIGN D-7) when it is missing or older than its sources:
# app.config.ts, package.json, package-lock.json, plugins/, modules/, assets/. The Gradle steps of the gate
# (native tests, Snyk) need it. android/ is git-ignored and never edited by hand.
set -eo pipefail
cd "$(dirname "$0")/.."
STAMP=android/.prebuild-stamp
sources=(app.config.ts package.json package-lock.json)
for d in plugins modules assets; do [ -d "$d" ] && sources+=("$d"); done

if [ ! -f "$STAMP" ]; then
  reason="android/ missing or never stamped"
elif [ -n "$(find "${sources[@]}" -newer "$STAMP" -print -quit)" ]; then
  reason="$(find "${sources[@]}" -newer "$STAMP" -print -quit) changed"
else
  echo "android/ is up to date"
  exit 0
fi
echo "prebuild: $reason"
# Default APP_VARIANT is development (the .debug app ID); the release script builds production with --clean.
npx expo prebuild --platform android --no-install
touch "$STAMP"
