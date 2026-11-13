#!/bin/bash
# The test emulator, the default target of `npm run device` (Jason, 2026-11-12): Android 16 (API 36, the
# phone's version), Google APIs x86_64 on KVM, screen 1080x2376 at 480 dpi = 360x792 dp like the phone.
#   avd.sh create   create the AVD "pitplanner" if missing
#   avd.sh start    start it headless (create first if needed), wait for boot, print its serial
#   avd.sh stop     shut it down and wait until it is gone (its memory is free when this returns)
set -euo pipefail
SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}"
NAME=pitplanner
# Fixed RAM for the emulator (Jason, 2026-11-12): passed on every start, so it holds whatever the AVD's
# config.ini says (the AVD made in T-006 says 4096). 3 GB runs the dev build with Metro and Maestro.
RAM_MB=3072
IMAGE="system-images;android-36;google_apis;x86_64"
AVD_DIR="${ANDROID_AVD_HOME:-$HOME/.android/avd}/$NAME.avd"

serial() { adb devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }'; }

create() {
  [ -d "$AVD_DIR" ] && return 0
  [ -r /dev/kvm ] && [ -w /dev/kvm ] || { echo "No access to /dev/kvm: the emulator would be too slow." >&2; exit 1; }
  echo no | "$SDK/cmdline-tools/latest/bin/avdmanager" create avd -n "$NAME" -k "$IMAGE" -d pixel_6 >/dev/null 2>&1
  # Phone-sized in dp; no boot animation or audio. RAM as RAM_MB above.
  cat >>"$AVD_DIR/config.ini" <<'INI'
hw.lcd.width=1080
hw.lcd.height=2376
hw.lcd.density=480
hw.ramSize=3072
hw.keyboard=no
hw.audioInput=no
hw.audioOutput=no
showDeviceFrame=no
INI
  echo "created AVD $NAME"
}

case "${1:-}" in
  create) create ;;
  start)
    create
    s="$(serial)"
    if [ -z "$s" ]; then
      nohup "$SDK/emulator/emulator" -avd "$NAME" -memory "$RAM_MB" -no-window -no-audio -no-boot-anim -no-snapshot-save \
        -gpu swiftshader_indirect >"${TMPDIR:-/tmp}/pitplanner-emulator.log" 2>&1 &
      for _ in $(seq 120); do s="$(serial)"; [ -n "$s" ] && break; sleep 1; done
      [ -n "$s" ] || { echo "Emulator did not appear (see ${TMPDIR:-/tmp}/pitplanner-emulator.log)." >&2; exit 1; }
    fi
    for _ in $(seq 180); do
      [ "$(adb -s "$s" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && break
      sleep 1
    done
    [ "$(adb -s "$s" shell getprop sys.boot_completed | tr -d '\r')" = 1 ] || { echo "Emulator did not boot." >&2; exit 1; }
    adb -s "$s" shell wm dismiss-keyguard >/dev/null 2>&1 || true
    adb -s "$s" shell settings put global window_animation_scale 0
    adb -s "$s" shell settings put global transition_animation_scale 0
    adb -s "$s" shell settings put global animator_duration_scale 0
    echo "$s"
    ;;
  stop)
    s="$(serial)"
    [ -n "$s" ] || exit 0
    adb -s "$s" emu kill >/dev/null
    for _ in $(seq 60); do
      adb devices | grep -q "^$s[[:space:]]" || pgrep -f "emulator.*-avd $NAME" >/dev/null || exit 0
      sleep 1
    done
    echo "Emulator $s did not stop." >&2
    exit 1
    ;;
  *)
    echo "usage: avd.sh create|start|stop" >&2
    exit 2
    ;;
esac
