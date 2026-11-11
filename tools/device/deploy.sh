#!/bin/bash
# Build the web UI and a debug APK, install over the existing app (keeps data).
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
npm run build >/dev/null
npx cap sync android >/dev/null
cd android
JAVA_HOME=/usr/lib/jvm/temurin-21-jdk ANDROID_HOME="$HOME/Android/Sdk" ./gradlew assembleDebug -q 2>&1 | grep -iE "^e:|error" || true
adb -s 5ece07c1 install -r app/build/outputs/apk/debug/app-debug.apk | tail -1
