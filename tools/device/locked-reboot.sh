#!/bin/bash
# Locked-reboot test (TASKS T-072, SPEC failure mode 6): after a restart, while the phone is still locked,
# a release build has its cook's alarms registered again, and a step that comes due before the first unlock
# rings. Required before every release (docs/RELEASING.md); on request otherwise.
#   tools/device/locked-reboot.sh <release apk>
# Runs on its own emulator, "pitplanner-lock" (avd.sh with AVD_LOCK=1): the same image as the usual one,
# with a PIN, so it boots locked with its credential-encrypted storage closed, like a phone after a restart.
# A release APK only: a dev build crashes at start while locked (React Native's dev support reads storage
# that is locked until the first unlock, docs/alarm-testing.md), which is a limit of dev builds, not of the app.
# The test owns that emulator: it clears Pit Planner's data there (`pm clear`) at the start of every run.
# Jason's limit, 2026-11-16: on the pitplanner-lock emulator only, "nowhere else: not the main emulator, not
# my phone" (clear_app_data below checks the target itself). The script never talks to a phone.
# Steps: start the emulator, set the PIN once, install the APK, clear its data, Setup with a griddle, open a
# plan file made for this run (chicken breasts, serve a little over an hour out) from the Files app, Start cook;
# write down the alarms; restart the emulator; while it is locked: the same alarms are registered, the app
# did not crash, and the first step that comes due posts its alert on the step channel; then unlock and end.
# `adb reboot` ends a headless emulator, so the restart is avd.sh stop and start.
# Output: PASS or FAIL lines, out/locked-reboot.txt; exit 0 only when every check passed.
set -uo pipefail
APK="$(realpath "${1:?usage: locked-reboot.sh <release apk>}")"
[ -f "$APK" ] || { echo "no such APK: $APK" >&2; exit 2; }
export AVD_LOCK=1 DEVICE_TARGET=emulator
unset ANDROID_SERIAL
# shellcheck source=tools/device/lib.sh
. "$(dirname "$0")/lib.sh"
cd "$DEVICE_DIR" || exit 1
APP=io.github.mecheng70.pitplanner
AVD=pitplanner-lock
PLAN_FILE=locked-reboot.pitplan
mkdir -p "$OUT"
REPORT="$OUT/locked-reboot.txt"
: >"$REPORT"
log() { echo "$*" | tee -a "$REPORT"; }
FAILED=0
pass() { log "PASS  $1"; }
fail() { FAILED=1; log "FAIL  $1"; }
stop_emulator() { ./avd.sh stop >/dev/null 2>&1; }
die() { fail "$1"; stop_emulator; exit 1; }

# --- the emulator ---------------------------------------------------------------------------------------
start_emulator() {
  ANDROID_SERIAL="$(./avd.sh start)" || return 1
  export ANDROID_SERIAL
  is_emulator && [ "$(A emu avd name | head -n 1 | tr -d '\r')" = "$AVD" ]
}
user_state() { A shell dumpsys user </dev/null | grep -m1 -oE 'RUNNING_[A-Z_]+'; }
keyguard() { A shell dumpsys window </dev/null | grep -q 'isKeyguardShowing=true'; }
# Type the PIN on the lock screen. Returns once the user is unlocked and the keyguard is gone.
unlock() {
  local _
  for _ in 1 2 3; do
    if [ "$(user_state)" = RUNNING_UNLOCKED ] && ! keyguard; then return 0; fi
    A shell input keyevent KEYCODE_WAKEUP
    A shell input keyevent 82 # the menu key: shows the PIN pad
    sleep 1
    A shell input text "$LOCK_PIN"
    A shell input keyevent 66
    sleep 3
  done
  [ "$(user_state)" = RUNNING_UNLOCKED ] && ! keyguard
}

# The one place this repo's tools clear an app's data. Jason's limit (2026-11-16): Pit Planner's data, on the
# pitplanner-lock emulator only, at the start of each run. "Nowhere else: not the main emulator, not my phone."
# So the target is checked again right here, whatever the rest of the script did: an emulator serial, and the
# AVD's own name read back from it.
clear_app_data() {
  [[ "${ANDROID_SERIAL:-}" == emulator-* ]] || return 1
  [ "$(adb -s "$ANDROID_SERIAL" emu avd name </dev/null | head -n 1 | tr -d '\r')" = "$AVD" ] || return 1
  adb -s "$ANDROID_SERIAL" shell pm clear "$APP" </dev/null >/dev/null
}

# --- the screen, by uiautomator alone (the Files app and the chooser are not the app: no Maestro flow) ----
rawdump() { A exec-out uiautomator dump /dev/tty </dev/null | sed 's#UI hierchary dumped to: /dev/tty##'; }
shows() { rawdump | grep -qE "(text|content-desc)=\"$1\""; }
# Tap the first control whose text or label is exactly $1.
tapt() {
  local b
  b=$(rawdump | grep -oE "<node[^>]*(text|content-desc)=\"$1\"[^>]*>" | head -1 |
    grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+' | tr '\n' ' ')
  [ -n "$b" ] || return 1
  # shellcheck disable=SC2086
  set -- $b
  A shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2))
  sleep 2
}
# Wait up to $2 seconds (default 20) for a control with the text or label $1.
wait_for() {
  local _
  for _ in $(seq "${2:-20}"); do
    shows "$1" && return 0
    sleep 1
  done
  return 1
}

# --- the app's alarms, as AlarmManager holds them: "<epoch ms> <FIRE|NAG>" a line, soonest first -----------
alarms() {
  # An alarm is one line on some Android builds and a block on others (its FIRE or NAG on a later line, in
  # `tag=` or `action`): take the time from the head line and the kind from the first line that names it.
  A shell dumpsys alarm </dev/null | awk -v app="$APP}" '
    function kind(line) { return match(line, /pitplanner\.(FIRE|NAG)/) ? substr(line, RSTART + 11, RLENGTH - 11) : "" }
    /^ *(RTC|ELAPSED)[A-Z_]* #/ {
      t = ""
      if (index($0, app) && match($0, /origWhen [0-9]+/)) {
        t = substr($0, RSTART + 9, RLENGTH - 9)
        if (kind($0) != "") { print t, kind($0); t = "" }
      }
      next
    }
    t != "" && kind($0) != "" { print t, kind($0); t = "" }
  ' | sort -n
}
clock() { date -d "@$(($1 / 1000))" +%T; }
# The step alert's notifications, as the system holds them (the emulator has no other app's worth hiding).
step_alerts() {
  A shell dumpsys notification --noredact </dev/null | grep -A60 "NotificationRecord.*pkg=$APP " | grep -c 'channel=steps_v1'
}
crashed() { A logcat -d -s AndroidRuntime:E </dev/null | grep -qF "Process: $APP,"; }

# --- 1. emulator, PIN, a clean install ----------------------------------------------------------------------
log "== locked-reboot: $(basename "$APK") on the emulator $AVD"
stop_emulator # one emulator at a time: the usual one, if it is up, goes first
start_emulator || die "the emulator $AVD did not start"
if A shell locksettings verify --old "$LOCK_PIN" </dev/null 2>&1 | grep -q 'verified successfully'; then
  log "    PIN already set"
else
  A shell locksettings set-pin "$LOCK_PIN" </dev/null >/dev/null 2>&1
  A shell locksettings verify --old "$LOCK_PIN" </dev/null 2>&1 | grep -q 'verified successfully' || die "could not set the PIN"
  log "    PIN set"
fi
unlock || die "could not unlock the emulator with the PIN"
A install -r "$APK" 2>&1 | tail -1 | grep -q Success || die "the APK did not install"
clear_app_data || die "refused to clear the app's data: the target is not the emulator $AVD"
A shell pm grant "$APP" android.permission.POST_NOTIFICATIONS
A shell settings put system font_scale 1.15
log "    installed, data cleared, notifications allowed, font scale 1.15"

# --- 2. Setup, the plan file, Start cook --------------------------------------------------------------------
# Serve a little over an hour out, on a 5 minute mark: under an hour the app moves a shared plan to the same
# weekday next week (suggestServe). With an 18 minute rest the breasts' steps are prep at 60 minutes before
# serve, the griddle at 45, on at 30 and off at 18, so the first one is due 3 to 8 minutes from now.
SERVE_MS=$(((($(date +%s) + 63 * 60) / 300 + 1) * 300 * 1000))
node -e '
  const [, serveAt, out] = process.argv;
  const plan = { app: "pit-planner", version: 1, serveAt: new Date(Number(serveAt)).toISOString(), pitTempF: 225,
    items: [{ id: "c", foodId: "breasts", methodId: "griddle", quantity: 4,
      options: { thickness: "pounded", brine: "none" }, restMin: 18 }] };
  require("fs").writeFileSync(out, JSON.stringify(plan, null, 2));
' "$SERVE_MS" "$OUT/$PLAN_FILE"
A push "$OUT/$PLAN_FILE" "/sdcard/Download/$PLAN_FILE" >/dev/null || die "could not push the plan file"

A shell monkey -p "$APP" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
wait_for "Welcome to Pit Planner" 40 || die "Setup did not open on a clean install"
tapt "Continue" && tapt "Griddle" && tapt "Continue" && wait_for "Finish setup" && tapt "Finish setup" || die "Setup did not finish"
wait_for "Plan" || die "Plan did not open after Setup"
log "    Setup done (griddle and oven)"

A shell am start -W -a android.intent.action.VIEW -d "content://com.android.externalstorage.documents/root/primary" \
  -t vnd.android.document/root >/dev/null 2>&1
wait_for "Download" && tapt "Download" && wait_for "$PLAN_FILE" && tapt "$PLAN_FILE" || die "the plan file was not found in Files"
# More than one app may take the file (the dev build, if it is installed too): pick the app by its name.
if wait_for "Just once" 5; then
  shows "Open with Pit Planner" || tapt "Pit Planner"
  tapt "Just once"
fi
wait_for "Open shared plan" 30 || die "the Shared plan sheet did not open"
A shell input swipe 540 1800 540 600 300
sleep 1
tapt "Use this plan" || die "Use this plan was not on the sheet"
wait_for "Start cook" || die "Start cook was not on Plan"
tapt "Start cook"
# With a permission missing the app asks first; the cook starts either way.
if wait_for "Start anyway" 4; then tapt "Start anyway"; fi
wait_for "Cook options" || die "the cook did not start"

NOW_MS=$(($(date +%s) * 1000))
mapfile -t BEFORE < <(alarms)
[ "${#BEFORE[@]}" -gt 0 ] || die "the running cook holds no alarms"
log "    cook started, ${#BEFORE[@]} alarm(s): $(for a in "${BEFORE[@]}"; do printf '%s %s, ' "$(clock "${a% *}")" "${a#* }"; done)"
# The step to wait for: the first one due at least 2.5 minutes from now, so the restart (about a minute)
# is over and the emulator is sitting locked when it comes due.
TARGET_MS=""
for a in "${BEFORE[@]}"; do
  if [ "${a#* }" = FIRE ] && [ "${a% *}" -ge $((NOW_MS + 150000)) ]; then
    TARGET_MS="${a% *}"
    break
  fi
done
[ -n "$TARGET_MS" ] || die "no step is due at least 2.5 minutes from now"
[ "$TARGET_MS" -le $((NOW_MS + 20 * 60000)) ] || die "the next step is more than 20 minutes away ($(clock "$TARGET_MS"))"
log "    the step to ring while locked: $(clock "$TARGET_MS")"

# --- 3. restart, and read while it is still locked ------------------------------------------------------
stop_emulator
start_emulator || die "the emulator did not come back"
sleep 20
STATE="$(user_state)"
if [ "$STATE" = RUNNING_LOCKED ] && keyguard; then pass "the emulator is locked after the restart ($STATE)"
else die "the emulator is not locked after the restart ($STATE): nothing is proven"; fi

if crashed; then fail "the app crashed at start while locked"; else pass "no crash of the app while locked"; fi
NOW_MS=$(($(date +%s) * 1000))
EXPECT=$(printf '%s\n' "${BEFORE[@]}" | awk -v now="$NOW_MS" '$1 > now' | tr '\n' ';')
GOT=$(alarms | awk -v now="$NOW_MS" '$1 > now' | tr '\n' ';')
if [ -n "$EXPECT" ] && [ "$GOT" = "$EXPECT" ]; then pass "every alarm still to come is registered again while locked ($(tr -cd ';' <<<"$GOT" | wc -c))"
else fail "the alarms while locked are not the cook's (want \"$EXPECT\", have \"$GOT\")"; fi

BEFORE_ALERTS=$(step_alerts)
while [ $(($(date +%s) * 1000)) -lt $((TARGET_MS + 20000)) ]; do sleep 2; done
STATE="$(user_state)"
[ "$STATE" = RUNNING_LOCKED ] || fail "the emulator was unlocked before the step came due ($STATE)"
AFTER_ALERTS=$(step_alerts)
if [ "$AFTER_ALERTS" -gt "$BEFORE_ALERTS" ]; then pass "the step due at $(clock "$TARGET_MS") rang while still locked (its alert is posted)"
else fail "the step due at $(clock "$TARGET_MS") did not ring while locked (alerts $BEFORE_ALERTS before, $AFTER_ALERTS after)"; fi
if alarms | grep -q ' NAG$'; then pass "its repeat is set"; else fail "no repeat is set for the step that rang"; fi
if crashed; then fail "the app crashed while locked"; fi

# --- 4. unlock, the app opens on the cook ---------------------------------------------------------------
if unlock; then
  A shell monkey -p "$APP" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  if wait_for "Cook options" 40; then pass "after unlock the app opens on the running cook"
  else fail "after unlock the app did not open on the running cook"; fi
else fail "could not unlock with the PIN after the test"; fi
stop_emulator
log "== locked-reboot: $([ $FAILED = 0 ] && echo PASS || echo FAIL)"
exit $FAILED
