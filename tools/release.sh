#!/bin/bash
# Build a release APK signed with the 0.1.0/0.2.0 key (TASKS T-007, TECH-DESIGN section 12).
#   npm run release                          the version in package.json (a real release: clean main)
#   npm run release -- --version 0.3.0-alpha.1   an internal prerelease (not distributed; any branch state)
#   --dry-run                                print the steps and checks, run nothing
#   --bundle                                 the Android App Bundle for Google Play instead of the APK (T-102)
#   --verify <apk or aab>                    only check a file's cert, package, version and app config
# Steps: stop the test emulator (it crashed once during a release build, 23 of 30 GB in use, and a build
# needs the memory); npm run check; production prebuild (--clean) with the version; assembleRelease (signing from
# plugins/withReleaseSigning and the git-ignored keystore.properties), in the same environment as the prebuild;
# verify the cert SHA-256, package, versionCode and versionName, and the embedded app config; copy to
# release/pitplanner-<version>.apk and print its SHA-256. On exit the development android/ is generated again,
# so the dev build and the gate keep working.
#
# --bundle is the same pipeline, checks and signing with bundleRelease in place of assembleRelease. It writes
# release/pitplanner-<version>.aab, and beside it the R8 mapping file (-mapping.txt, for Play's crash reports)
# and the manifest merger report (-manifest-merger-report.txt: where each permission comes from). Both are
# copied before the exit step deletes android/. A bundle is refused when it asks for a permission in
# PLAY_REFUSED.
#
# The variant and version go to the Gradle build too, not only to the prebuild (T-035, security pass finding
# 1): expo-constants writes assets/app.config (what Constants.expoConfig reads: Gear's version, the update
# check, Export my data, Send to developer) during the Gradle build, by evaluating app.config.ts again with
# Gradle's environment. Without them 0.3.0-alpha.5 said 0.2.0, build 200999, variant development.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
CERT_SHA256=b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29
APP_ID=io.github.mecheng70.pitplanner
# Permissions Google Play allows for a few app types only, which Pit Planner is not (T-102, 2026-11-20).
PLAY_REFUSED=(android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)

VERSION="" DRY="" VERIFY="" BUNDLE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?--version needs a value}"; shift ;;
    --dry-run) DRY=1 ;;
    --bundle) BUNDLE=1 ;;
    --verify) VERIFY="${2:?--verify needs an APK or a bundle}"; shift ;;
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
# As a string: console.log colours a number when FORCE_COLOR is set (`node --test` sets it on a terminal),
# and the colour codes would end up in the versionCode.
CODE=$(node -e 'import("./plugins/version.ts").then(m => console.log(String(m.versionCode(process.argv[1]))))' "$V") || exit 2
APK="release/pitplanner-$V.apk"
AAB="release/pitplanner-$V.aab"
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
  # What the app itself reads at run time (finding 1): version, versionCode, app ID, production variant.
  local config
  config=$(unzip -p "$1" assets/app.config) || { echo "WRONG APP CONFIG: no assets/app.config in $1" >&2; return 1; }
  node tools/release-app-config.mjs "$V" "$CODE" "$APP_ID" <<<"$config" || return 1
}
# The same for a bundle. A bundle is signed as a JAR (apksigner does not read one): jarsigner checks the
# signature, keytool prints its certificate. Its manifest is in the base module in protobuf form, which aapt2
# reads from an APK: the manifest and the resource table, zipped, are one.
verify_aab() {
  local signed digest tmp badging permissions refused config
  signed=$(jarsigner -verify "$1") || true
  [[ "$signed" == *"jar verified."* ]] || { echo "NOT SIGNED: jarsigner says: ${signed:-nothing}" >&2; return 1; }
  digest=$(keytool -printcert -jarfile "$1" | sed -nE 's/^[[:space:]]*SHA256: ([0-9A-Fa-f:]+).*/\1/p' | tr -d : | tr 'A-F' 'a-f' | sort -u)
  [ "$digest" = "$CERT_SHA256" ] || { echo "WRONG CERT: $digest (must be $CERT_SHA256)" >&2; return 1; }
  tmp=$(mktemp -d)
  unzip -q "$1" base/manifest/AndroidManifest.xml base/resources.pb -d "$tmp" &&
    mv "$tmp/base/manifest/AndroidManifest.xml" "$tmp/base/" &&
    (cd "$tmp/base" && zip -q ../manifest.apk AndroidManifest.xml resources.pb) ||
    { rm -rf "$tmp"; echo "WRONG PACKAGE OR VERSION: no base manifest in $1" >&2; return 1; }
  badging=$("$BT/aapt2" dump badging "$tmp/manifest.apk" | sed -n 1p)
  permissions=$("$BT/aapt2" dump permissions "$tmp/manifest.apk" | sed -nE "s/^uses-permission: name='([^']+)'/\1/p")
  rm -rf "$tmp"
  [[ "$badging" == *"name='$APP_ID' versionCode='$CODE' versionName='$V'"* ]] ||
    { echo "WRONG PACKAGE OR VERSION: $badging" >&2; return 1; }
  echo "cert ok; $badging"
  # Every permission the bundle asks for: what Play Console's declarations have to cover.
  sed 's/^/permission: /' <<<"$permissions"
  for refused in "${PLAY_REFUSED[@]}"; do
    ! grep -qx "$refused.*" <<<"$permissions" || { echo "WRONG PERMISSIONS: the bundle asks for $refused" >&2; return 1; }
  done
  config=$(unzip -p "$1" base/assets/app.config) || { echo "WRONG APP CONFIG: no base/assets/app.config in $1" >&2; return 1; }
  node tools/release-app-config.mjs "$V" "$CODE" "$APP_ID" <<<"$config" || return 1
}
if [ -n "$VERIFY" ]; then
  if [[ "$VERIFY" == *.aab ]]; then verify_aab "$VERIFY"; else verify_apk "$VERIFY"; fi
  exit
fi

if [ -n "$BUNDLE" ]; then
  FILE="$AAB" EXTRAS=("release/pitplanner-$V-mapping.txt" "release/pitplanner-$V-manifest-merger-report.txt")
else
  FILE="$APK" EXTRAS=()
fi
echo "release $V, versionCode $CODE, app ID $APP_ID -> $FILE"
echo "cert SHA-256 must be $CERT_SHA256"
problems=()
[ -f keystore.properties ] || problems+=("keystore.properties missing at the repo root (see keystore.properties.example)")
[ -e "$FILE" ] && problems+=("$FILE already exists; a release file is never overwritten")
for f in "${EXTRAS[@]}"; do [ -e "$f" ] && problems+=("$f already exists; a release file is never overwritten"); done
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
# The same, in folder $1. What it prints is exactly what it hands to `env`.
run_in() {
  local dir="$1"
  shift
  echo "+ (cd $dir && $*)"
  [ -n "$DRY" ] || (cd "$dir" && env "$@")
}
# The production variant and the version, for the prebuild AND the Gradle build (finding 1, see the top).
RELEASE_ENV=(APP_VARIANT=production "APP_VERSION=$V")
restore_dev() {
  echo "== generating the development android/ again"
  run npx expo prebuild --platform android --clean --no-install && { [ -n "$DRY" ] || touch android/.prebuild-stamp; }
}

run tools/device/avd.sh stop
run npm run check
[ -n "$DRY" ] || trap restore_dev EXIT
run "${RELEASE_ENV[@]}" npx expo prebuild --platform android --clean --no-install
if [ -n "$BUNDLE" ]; then
  run_in android "${RELEASE_ENV[@]}" MALLOC_ARENA_MAX=2 ./gradlew -q bundleRelease
  OUT_AAB=android/app/build/outputs/bundle/release/app-release.aab

  echo "+ jarsigner -verify $OUT_AAB"
  echo "+ keytool -printcert -jarfile $OUT_AAB"
  echo "+ unzip -p $OUT_AAB base/assets/app.config | node tools/release-app-config.mjs $V $CODE $APP_ID"
  MERGER=android/app/build/outputs/logs/manifest-merger-release-report.txt
  if [ -z "$DRY" ] && ! verify_aab "$OUT_AAB"; then
    # android/ is deleted on exit: say now where each permission came from.
    echo "permissions in the manifest merger report, each with its source:" >&2
    grep -A1 '^uses-permission#' "$MERGER" >&2 || true
    exit 1
  fi
  mkdir -p release
  run cp "$OUT_AAB" "$AAB"
  run cp android/app/build/outputs/mapping/release/mapping.txt "${EXTRAS[0]}"
  run cp "$MERGER" "${EXTRAS[1]}"
  [ -n "$DRY" ] || sha256sum "$AAB"
else
  run_in android "${RELEASE_ENV[@]}" MALLOC_ARENA_MAX=2 ./gradlew -q assembleRelease
  OUT_APK=android/app/build/outputs/apk/release/app-release.apk

  echo "+ $BT/apksigner verify --print-certs $OUT_APK"
  echo "+ unzip -p $OUT_APK assets/app.config | node tools/release-app-config.mjs $V $CODE $APP_ID"
  [ -n "$DRY" ] || verify_apk "$OUT_APK"
  mkdir -p release
  run cp "$OUT_APK" "$APK"
  [ -n "$DRY" ] || sha256sum "$APK"
fi
[ -z "$DRY" ] || restore_dev
