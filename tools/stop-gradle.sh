#!/bin/bash
# Stop the Gradle and Kotlin compile daemons (Jason, 2026-11-12). They stay in memory after a build (together
# they held 8 GB when a device run with the emulator open ran the machine out of memory). Safe to run any
# time: the next build starts new ones. Does nothing when android/ is missing.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}"
if [ -x "$ROOT/android/gradlew" ]; then (cd "$ROOT/android" && ./gradlew --stop >/dev/null 2>&1) || true; fi
# The Kotlin daemon is not Gradle's to stop. The bracket keeps pkill from matching this script's own command.
pkill -f '[K]otlinCompileDaemon' 2>/dev/null || true
for _ in $(seq 10); do pgrep -f '[G]radleDaemon|[K]otlinCompileDaemon' >/dev/null || break; sleep 1; done
exit 0
