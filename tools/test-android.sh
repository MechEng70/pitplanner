#!/bin/bash
# Native unit tests (JUnit; Robolectric where Android classes are involved): android/app/src/test.
set -eo pipefail
cd "$(dirname "$0")/../android"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
./gradlew -q testDebugUnitTest
echo "android unit tests passed"
