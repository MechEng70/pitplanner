#!/bin/bash
# Signed release APK: tools/release.sh -> release/pitplanner-<version>.apk
# Needs android/keystore.properties (see keystore.properties.example). Bump "version" in package.json
# before each release; the Android versionCode is derived from it and must go up.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROPS=android/keystore.properties
if [ ! -f "$PROPS" ] || grep -qE '^(storePassword|keyPassword)=\s*$' "$PROPS"; then
  echo "Fill in the passwords in $PROPS first (template: android/keystore.properties.example)."; exit 1
fi
VERSION=$(node -p "require('./package.json').version")
npm test >/dev/null
npm run build >/dev/null
npx cap sync android >/dev/null
export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk ANDROID_HOME="$HOME/Android/Sdk"
(cd android && ./gradlew assembleRelease -q 2>&1 | grep -iE "^e:|error|fail" || true)
APK=android/app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || { echo "No signed APK was built (check keystore.properties)."; exit 1; }
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
"$BT/apksigner" verify --print-certs "$APK" | grep -E "Signer #1 certificate (DN|SHA-256)"
"$BT/aapt" dump badging "$APK" | grep -oE "versionCode='[0-9]+' versionName='[^']+'"
mkdir -p release
OUT="release/pitplanner-$VERSION.apk"
cp "$APK" "$OUT"
echo "$OUT ($(du -h "$OUT" | cut -f1))"
