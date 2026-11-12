#!/bin/bash
# Generate android/ (Continuous Native Generation, TECH-DESIGN D-7) when it is missing or older than its sources:
# app.config.ts (and the tokens it reads), package.json, package-lock.json, plugins/, modules/, assets/. Gradle output
# inside modules/ (build/, .gradle/, .cxx/) is not a source, and only files count: Gradle creating build/ bumps its
# parent folder's time. (A deleted source file alone does not trigger; rerun prebuild by hand then.) The gate's
# Gradle steps (native tests, Snyk) need
# android/; it is git-ignored and never edited by hand.
# --dry-run: print the decision only. PREBUILD_ROOT: project root (tools/prebuild.test.mjs uses a temp tree).
set -eo pipefail
cd "${PREBUILD_ROOT:-$(dirname "$0")/..}"
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
STAMP=android/.prebuild-stamp
sources=(app.config.ts src/theme/tokens.ts package.json package-lock.json)
for d in plugins modules assets; do [ -d "$d" ] && sources+=("$d"); done

if [ ! -f "$STAMP" ]; then
  reason="android/ missing or never stamped"
elif changed="$(find "${sources[@]}" \( -name build -o -name .gradle -o -name .cxx \) -prune -o -type f -newer "$STAMP" -print -quit)" &&
  [ -n "$changed" ]; then
  reason="$changed changed"
else
  echo "android/ is up to date"
  exit 0
fi
echo "prebuild: $reason"
[ $DRY = 1 ] && exit 0
# Default APP_VARIANT is development (the .debug app ID); the release script builds production with --clean.
npx expo prebuild --platform android --no-install
touch "$STAMP"
