#!/bin/bash
# Build a release APK signed with the 0.1.0/0.2.0 key (TASKS T-007, TECH-DESIGN section 12).
#   npm run release                          the version in package.json (a real release: clean main)
#   npm run release -- --version 0.3.0-alpha.1   an internal prerelease (not distributed; any branch state)
#   --dry-run                                print the steps and checks, run nothing
#   --verify <apk>                           only check an APK's cert, package and version
# Steps: stop the test emulator (it crashed once during a release build, 23 of 30 GB in use, and a build
# needs the memory); npm run check; production prebuild (--clean) with the version; assembleRelease (signing from
# plugins/withReleaseSigning and the git-ignored keystore.properties); verify the cert SHA-256, package,
# versionCode and versionName; copy to release/pitplanner-<version>.apk and print its SHA-256. On exit the
# development android/ is generated again, so the dev build and the gate keep working.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
CERT_SHA256=b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29
APP_ID=io.github.mecheng70.pitplanner

VERSION="" DRY="" VERIFY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?--version needs a value}"; shift ;;
    --dry-run) DRY=1 ;;
    --verify) VERIFY="${2:?--verify needs an APK}"; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

PKG_VERSION=$(node -p "require('./package.json').version")
if [ -n "$VERSION" ] && ! [[ "$VERSION" =~ -(alpha|beta|rc)\.[0-9]+$ ]]; then
  echo "--version is for an internal prerelease (x.y.z-alpha.N); for a release, bump package.json." >&2
  exit 2
fi
V="${VERSION:-$PKG_VERSION}"
CODE=$(node -e 'import("./plugins/version.ts").then(m => console.log(m.versionCode(process.argv[1])))' "$V") || exit 2
APK="release/pitplanner-$V.apk"
BT="${RELEASE_BUILD_TOOLS:-$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)}"

# Cert, package, versionCode and versionName of an APK. No `| head` on a producer: under pipefail its
# SIGPIPE fails the script (exit 141 after a full build, T-007's first run); sed reads everything.
verify_apk() {
  local digest badging
  digest=$("$BT/apksigner" verify --print-certs "$1" | sed -nE 's/.*certificate SHA-256 digest: ([0-9a-f]+).*/\1/p' | sort -u)
  [ "$digest" = "$CERT_SHA256" ] || { echo "WRONG CERT: $digest (must be $CERT_SHA256)" >&2; return 1; }
  badging=$("$BT/aapt2" dump badging "$1" | sed -n 1p)
  [[ "$badging" == *"name='$APP_ID' versionCode='$CODE' versionName='$V'"* ]] ||
    { echo "WRONG PACKAGE OR VERSION: $badging" >&2; return 1; }
  echo "cert ok; $badging"
}
if [ -n "$VERIFY" ]; then
  verify_apk "$VERIFY"
  exit
fi

echo "release $V, versionCode $CODE, app ID $APP_ID -> $APK"
echo "cert SHA-256 must be $CERT_SHA256"
problems=()
[ -f keystore.properties ] || problems+=("keystore.properties missing at the repo root (see keystore.properties.example)")
[ -e "$APK" ] && problems+=("$APK already exists; a release APK is never overwritten")
if [ -z "$VERSION" ]; then
  [ "$(git branch --show-current)" = main ] || problems+=("not on main")
  [ -z "$(git status --porcelain)" ] || problems+=("working tree not clean")
fi
if [ ${#problems[@]} -gt 0 ]; then
  printf 'problem: %s\n' "${problems[@]}" >&2
  [ -n "$DRY" ] || exit 1
fi

run() {
  echo "+ $*"
  [ -n "$DRY" ] || env "$@"
}
restore_dev() {
  echo "== generating the development android/ again"
  run npx expo prebuild --platform android --clean --no-install && { [ -n "$DRY" ] || touch android/.prebuild-stamp; }
}

run tools/device/avd.sh stop
run npm run check
[ -n "$DRY" ] || trap restore_dev EXIT
run APP_VARIANT=production APP_VERSION="$V" npx expo prebuild --platform android --clean --no-install
echo "+ (cd android && ./gradlew assembleRelease)"
[ -n "$DRY" ] || (cd android && ./gradlew -q assembleRelease)
OUT_APK=android/app/build/outputs/apk/release/app-release.apk

echo "+ $BT/apksigner verify --print-certs $OUT_APK"
[ -n "$DRY" ] || verify_apk "$OUT_APK"
mkdir -p release
run cp "$OUT_APK" "$APK"
[ -n "$DRY" ] || sha256sum "$APK"
[ -z "$DRY" ] || restore_dev
