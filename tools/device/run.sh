#!/bin/bash
# One unattended device pass on the dev build (TASKS T-006).
#   npm run device -- [--phone] [--no-build] [--repeat N] [--only <test>]...
#   tests: smoke, sheet-keyboard, stable-controls, db, migration-error, db-unopenable, legacy-import, alarm,
#   plan, plan-3button
#   DEVICE_SCALES="1.0 1.15 1.3" adds or changes the font scales (default 1.15 and 1.3).
#   (default: all).
#   --repeat N runs the chosen tests N times at each font scale (to catch a test that only sometimes fails). --only repeats or takes a comma list.
# Target: the test emulator (tools/device/avd.sh; started headless if needed and stopped again), or with
# --phone the real phone, only for tests that need real hardware (TASKS "Real phone"; Jason, 2026-11-12).
# Safety on the phone (Jason's own): stops if it is locked; backs up the dev build's data and restores it on
# exit. On both: heads-up banners off, screen kept on, each test at font scale 1.15 and 1.3 with the app
# relaunched after each change, every setting put back on exit. The device log is cleared before and after
# the run and saved only when a test fails: the app's own lines, redacted for token patterns.
# Starts Metro when it is not running (and stops it again). Output: out/report.txt, out/<scale>/*, out/*.png.
# Screenshots are cropped below the status bar.
set -uo pipefail
# shellcheck source=tools/device/lib.sh
. "$(dirname "$0")/lib.sh"
cd "$DEVICE_DIR" || exit 1

ALL=(smoke sheet-keyboard stable-controls db migration-error db-unopenable legacy-import alarm plan plan-3button)
TESTS=()
NOBUILD=""
REPEAT=1
export DEVICE_TARGET=emulator
while [ $# -gt 0 ]; do
  case "$1" in
    --no-build) NOBUILD=1 ;;
    --phone) DEVICE_TARGET=phone ;;
    --repeat)
      REPEAT="${2:?--repeat needs a number}"
      [[ "$REPEAT" =~ ^[1-9][0-9]*$ ]] || { echo "--repeat needs a number" >&2; exit 2; }
      shift
      ;;
    --only)
      IFS=, read -r -a more <<<"${2:?--only needs a test name}"
      TESTS+=("${more[@]}")
      shift
      ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
[ ${#TESTS[@]} -gt 0 ] || TESTS=("${ALL[@]}")
for t in "${TESTS[@]}"; do
  [[ " ${ALL[*]} " == *" $t "* ]] || { echo "unknown test $t (have: ${ALL[*]})" >&2; exit 2; }
done

mkdir -p "$OUT"
REPORT="$OUT/report.txt"
: >"$REPORT"
log() { echo "$*" | tee -a "$REPORT"; }

# --- build first, with no emulator running ------------------------------------------------------------------
# Memory (Jason, 2026-11-12): a build with the emulator open ran the machine out of memory. So the APK is
# built before the emulator starts, and the Gradle and Kotlin daemons are stopped before it boots (also with
# --no-build: daemons left by an earlier build go too). The install happens once the target is up.
APK_BUILT=""
if [ -z "$NOBUILD" ]; then
  log "== build the dev build"
  (cd "$ROOT" && tools/prebuild-if-stale.sh &&
    cd android && JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" MALLOC_ARENA_MAX=2 ./gradlew -q assembleDebug) 2>&1 |
    tail -5 | tee -a "$REPORT"
  [ "${PIPESTATUS[0]}" -eq 0 ] || { log "build failed"; exit 1; }
  APK_BUILT=1
fi
"$ROOT/tools/stop-gradle.sh" && log "Gradle and Kotlin daemons stopped"

# --- target ---------------------------------------------------------------------------------------------
EMU_STARTED=""
if [ "$DEVICE_TARGET" = emulator ] && [ -z "${ANDROID_SERIAL:-}" ] && ! pick_target 2>/dev/null; then
  log "== starting the emulator"
  ANDROID_SERIAL=$(./avd.sh start) || { log "emulator did not start"; exit 1; }
  export ANDROID_SERIAL
  EMU_STARTED=1
fi
pick_target || exit 1
log "target: $DEVICE_TARGET ($ANDROID_SERIAL)"

# --- safety: wake, refuse if locked, settings saved and restored on exit --------------------------------
A shell input keyevent KEYCODE_WAKEUP
# A just-booted emulator can still be showing its (swipe) keyguard for a few seconds: T-010's first run
# stopped here with "locked". Ask again until it is gone; the phone is never unlocked this way.
if is_emulator; then
  for _ in $(seq 15); do
    A shell wm dismiss-keyguard
    A shell dumpsys window | grep -q "isKeyguardShowing=true" || break
    sleep 1
  done
fi
if A shell dumpsys window | grep -q "isKeyguardShowing=true"; then
  echo "Phone is locked. Unlock it, then run again."
  exit 1
fi
ORIG_SCALE=$(A shell settings get system font_scale | tr -d '\r')
ORIG_STAYON=$(A shell settings get global stay_on_while_plugged_in | tr -d '\r')
ORIG_HEADSUP=$(A shell settings get global heads_up_notifications_enabled | tr -d '\r')
METRO_PID=""
BACKUP=""
restore() {
  if printf '%s\n' "${RESULTS[@]}" | grep -q '^FAIL'; then
    save_app_logcat "$OUT/logcat-failed.txt" && log "app log (redacted): $OUT/logcat-failed.txt"
  fi
  clear_logcat
  # The Doze step of the alarm test: never leave the emulator idle-forced or its battery "unplugged".
  if is_emulator; then
    A shell dumpsys deviceidle unforce >/dev/null 2>&1
    A shell dumpsys battery reset >/dev/null 2>&1
    A shell device_config delete device_idle min_time_to_alarm >/dev/null 2>&1
  fi
  nav_back && [ -z "$NAV_BEFORE" ] || log "navigation mode NOT put back (was $NAV_BEFORE)"
  if [ -n "$BACKUP" ]; then ./db.sh restore "$BACKUP" | tee -a "$REPORT"; fi
  A shell settings put system font_scale "$ORIG_SCALE" && log "font scale back to $ORIG_SCALE"
  A shell settings put global stay_on_while_plugged_in "$ORIG_STAYON"
  A shell settings put global heads_up_notifications_enabled "$ORIG_HEADSUP" && log "heads-up back to $ORIG_HEADSUP"
  if [ -n "$METRO_PID" ]; then kill -- "-$METRO_PID" 2>/dev/null && log "Metro stopped"; fi
  if [ -n "$EMU_STARTED" ]; then ./avd.sh stop && log "emulator stopped"; fi
}
# Navigation mode, emulator only (the phone's is Jason's and is never changed): gestural is the image's
# default (a 24 dp bar under the app), threebutton has a 48 dp bar. `settings get secure navigation_mode`
# follows the overlay at once: 0 three buttons, 1 two buttons, 2 gestures. nav_back puts back what was there.
NAV_BEFORE=""
nav_set() {
  local code
  case "$1" in threebutton) code=0 ;; twobutton) code=1 ;; gestural) code=2 ;; *) return 2 ;; esac
  A shell cmd overlay enable-exclusive --category "com.android.internal.systemui.navbar.$1" >/dev/null 2>&1
  for _ in $(seq 10); do
    [ "$(A shell settings get secure navigation_mode | tr -d '\r')" = "$code" ] && return 0
    sleep 1
  done
  return 1
}
nav_mode() {
  is_emulator || return 1
  [ -n "$NAV_BEFORE" ] || NAV_BEFORE=$(A shell settings get secure navigation_mode | tr -d '\r')
  nav_set "$1"
}
nav_back() {
  local name
  [ -n "$NAV_BEFORE" ] || return 0
  case "$NAV_BEFORE" in 0) name=threebutton ;; 1) name=twobutton ;; *) name=gestural ;; esac
  nav_set "$name" && NAV_BEFORE=""
}
RESULTS=()
trap restore EXIT
rm -f "$OUT/logcat-failed.txt"
clear_logcat
A shell svc power stayon usb
# Other apps' heads-up banners (chat messages) must not land in screenshots.
A shell settings put global heads_up_notifications_enabled 0

# --- install, Metro, backup -------------------------------------------------------------------------------
if [ -n "$APK_BUILT" ]; then
  log "== install the dev build"
  A install -r "$ROOT/android/app/build/outputs/apk/debug/app-debug.apk" 2>&1 | tail -2 | tee -a "$REPORT"
  [ "${PIPESTATUS[0]}" -eq 0 ] || { log "install failed"; exit 1; }
fi
# The dev client's floating tools button sits over the top right corner of every screen (Plan's share icon).
# On the emulator it is turned off in the dev menu's own preferences; the menu still opens from its
# notification. The phone's dev build keeps it.
if is_emulator; then
  fab_prefs=shared_prefs/expo.modules.devmenu.sharedpreferences.xml
  fab_now=$(A shell run-as "$PKG" cat "$fab_prefs" 2>/dev/null | tr -d '\r')
  if [[ "$fab_now" == *"</map>"* ]] && [[ "$fab_now" != *'name="showFab"'* ]]; then
    A shell am force-stop "$PKG"
    sed 's#</map>#    <boolean name="showFab" value="false" />\n</map>#' <<<"$fab_now" |
      A shell run-as "$PKG" sh -c "'cat >$fab_prefs'" && log "dev tools button off on the emulator"
  fi
fi
if ! curl -s "localhost:$METRO_PORT/status" | grep -q running; then
  log "== starting Metro"
  (cd "$ROOT" && exec setsid npx expo start --dev-client --port "$METRO_PORT" </dev/null >"$OUT/metro.log" 2>&1) &
  METRO_PID=$!
  for _ in $(seq 60); do curl -s "localhost:$METRO_PORT/status" | grep -q running && break; sleep 1; done
  curl -s "localhost:$METRO_PORT/status" | grep -q running || { log "Metro did not start (out/metro.log)"; exit 1; }
fi
A shell pm path "$PKG" >/dev/null 2>&1 || { log "the dev build is not installed on $ANDROID_SERIAL (run without --no-build)"; exit 1; }
# The phone's dev build data is backed up and restored; the emulator holds nothing of Jason's.
if ! is_emulator; then
  BACKUP=$(./db.sh backup) || { log "backup failed"; exit 1; }
  log "data backed up to $BACKUP"
  # Keep the two newest backups (Jason, 2026-11-12); this run's is the newest.
  # Names are data-YYYYMMDD-HHMMSS.tar, so the glob's order is oldest first.
  backups=("$OUT"/data-*.tar)
  if [ ${#backups[@]} -gt 2 ]; then
    rm -f -- "${backups[@]:0:${#backups[@]}-2}" && log "removed $((${#backups[@]} - 2)) older backup(s)"
  fi
fi

SCREEN_H=$(A shell wm size | grep -oE '[0-9]+$')
result() { RESULTS+=("$1"); log "$1"; }

# Screenshot of the phone, cropped below the status bar. The keyboard never shows: its banners ("Emoji size
# updated") and clipboard suggestions are not the app. By default an open keyboard is closed first (back closes
# only the keyboard); with --cut-keyboard (sheet-keyboard, where the open keyboard is the point) the image ends
# at the keyboard's top edge instead.
shot() {
  local file="$1" ime
  ime=$(ime_top)
  if [ -n "$ime" ] && [ "${2:-}" != --cut-keyboard ]; then
    A shell input keyevent KEYCODE_BACK
    sleep 1
    ime=""
  fi
  wait_for_refresh
  A exec-out screencap -p >"$file"
  # The banner can appear between the check and the capture (a reload): if it is up now, wait and retake.
  if refreshing; then
    wait_for_refresh
    A exec-out screencap -p >"$file"
  fi
  python3 -I crop.py "$(status_bar_px)" "$file" ${ime:+--bottom "$ime"}
}

# Scroll LABEL into view unless it is already fully on screen (above the keyboard when it is open). Scrolls
# up when it is above the visible area, otherwise $2 (default DOWN: a control not in the tree is further on).
on_screen() {
  local label="$1" tmp="$OUT/.on-screen.xml" bottom rc=0
  bottom=$(ime_top)
  dump >"$tmp" || return 1
  node check.mjs find "$tmp" "$label" "$(status_bar_px)" "${bottom:-$SCREEN_H}" >/dev/null || rc=$?
  case $rc in
    0) return 0 ;;
    3) scroll_to "$label" UP | tee -a "$REPORT" ;; # above the visible area
    *) scroll_to "$label" "${2:-DOWN}" | tee -a "$REPORT" ;;
  esac
}

# --- tests ------------------------------------------------------------------------------------------------
# The app opens on Plan and each tab opens: tap the tab, check it is the selected tab, take a screenshot.
test_smoke() {
  local s="$1" dir="$2" tab ok=1
  launch "" || { result "FAIL  smoke $s: app did not open"; return; }
  for tab in Plan Cook Gear; do
    tap "$tab" 1 | tee -a "$REPORT"
    # The kit BottomNav: each tab is labelled with its name and the open one is selected.
    if dump >"$dir/$tab.xml" && grep -q "content-desc=\"$tab\"[^>]*selected=\"true\"" "$dir/$tab.xml"; then
      shot "$dir/${tab,,}.png"
    else
      ok=0
      log "    $tab: tab did not open"
    fi
  done
  if [ $ok = 1 ]; then result "PASS  smoke $s"; else result "FAIL  smoke $s"; fi
}

# D-4 condition (Jason, 2026-11-12): in a kit Sheet with the keyboard open, the focused field and the pinned
# footer stay visible. The kit gallery's form sheet has a field at the top and one under a long body: Weight
# (bottom) is focused first, then Name (top) with the keyboard still open.
test_sheet_keyboard() {
  local s="$1" dir="$2" field ok=1 out line
  launch "dev/kit?sheet=form" || { result "FAIL  sheet-keyboard $s: app did not open"; return; }
  for field in Weight Name; do
    on_screen "$field" UP
    tap "$field" 1 | tee -a "$REPORT"
    sleep 1
    if ! dump >"$dir/keyboard-$field.xml"; then
      ok=0
      log "    $field: could not read the screen"
      continue
    fi
    if out=$(node check.mjs keyboard "$dir/keyboard-$field.xml" "$field" Save "$(ime_top)" "$(status_bar_px)"); then
      log "    $field focused: field and Save above the keyboard"
    else
      ok=0
      while IFS= read -r line; do log "    $field: $line"; done <<<"$out"
    fi
    shot "$dir/sheet-keyboard-$field.png" --cut-keyboard
  done
  if [ $ok = 1 ]; then result "PASS  sheet-keyboard $s"; else result "FAIL  sheet-keyboard $s"; fi
}

# T-017 PR-3: tapping a control moves neither it nor anything above it. Targets in targets.tsv (start at the
# top or scrolled to the bottom). Each step compares the screen just before and just after its taps.
test_stable_controls() {
  local s="$1" dir="$2" target route start expect label times cur="" cur_expect="" moved_any="" broken="" n=0 out line
  local before after
  finish_target() {
    [ -n "$cur" ] || return 0
    if [ -n "$broken" ]; then result "FAIL  stable-controls $s $cur: could not read the screen"
    elif [ "$cur_expect" = moves ]; then
      if [ -n "$moved_any" ]; then result "PASS  stable-controls $s $cur: jump detected (detector self-test)"
      else result "FAIL  stable-controls $s $cur: expected a jump, none detected"; fi
    elif [ -n "$moved_any" ]; then result "FAIL  stable-controls $s $cur: controls moved"
    else result "PASS  stable-controls $s $cur"; fi
  }
  # fd 3: nothing inside the loop may read the targets file by accident.
  while IFS=$'\t' read -r target route start expect label times <&3; do
    [[ -z "$target" || "$target" == \#* ]] && continue
    if [ "$target" != "$cur" ]; then
      finish_target
      cur="$target" cur_expect="$expect" moved_any="" broken="" n=0
      launch "$route" || { result "FAIL  stable-controls $s $target: app did not open"; cur=""; continue; }
      # Scrolled to the end, content that shrinks below a control makes the view clamp and jump (Jason's T-004
      # review): those targets start at the bottom.
      if [ "$start" = bottom ]; then scroll_bottom | tee -a "$REPORT"; fi
    fi
    n=$((n + 1))
    before="$dir/stable-$target-$n-before.xml" after="$dir/stable-$target-$n-after.xml"
    # Started at the bottom, a control that is not on screen can only be above: scroll up to it. That is as
    # far down as the screen can be with the control still in reach.
    if ! on_screen "$label" "$([ "$start" = bottom ] && echo UP || echo DOWN)" || ! dump >"$before"; then
      broken=1
      continue
    fi
    tap "$label" "$times" | tee -a "$REPORT"
    if ! dump >"$after"; then broken=1; continue; fi
    if out=$(node check.mjs stable "$before" "$after" "$label"); then
      log "    $label x$times: nothing moved"
    else
      moved_any=1
      log "    $label x$times:"
      while IFS= read -r line; do log "      $line"; done <<<"$out"
    fi
  done 3<targets.tsv
  finish_target
}

# A line of text on the screen (uiautomator `text=`), exactly.
has_text() { grep -qF "text=\"$2\"" "$1"; }
SCHEMA_VERSION=$(find "$ROOT/src/db/migrations" -name '[0-9][0-9][0-9][0-9]_*.ts' | wc -l)
ERROR_TITLE="Pit Planner couldn't update"
ERROR_BODY="Your data is safe. Tap Export my data and send the file to Jason."
DB_TABLES="tables active_cook, cook_history, cook_history_items, cookers, kv, rate_overrides"

# T-010: the real expo-sqlite database opens and migrates (version, WAL, the six tables), and a change made
# through the store is still there after the app is killed and started again. The dev database screen
# (pitplanner://dev/db) saves the units and shows what the database holds; `launch` force-stops first, so the
# second launch can only know the units from the database. C then F, so each pass sees a real change.
test_db() {
  local s="$1" dir="$2" ok=1 u w want saved
  for u in C F; do
    [ "$u" = C ] && w=kg || w=lb
    launch "dev/db?set=$u" || { result "FAIL  db $s: app did not open"; return; }
    # The change must be on screen before the kill; otherwise this would test the link, not the database.
    # The link is sent once: if the save does not show, that is a failure, not something to retry.
    saved=""
    for _ in $(seq 15); do
      if dump >"$dir/db-$u-set.xml" && has_text "$dir/db-$u-set.xml" "units $u $w"; then saved=1; break; fi
      sleep 1
    done
    if [ -z "$saved" ]; then ok=0; log "    the app did not show units $u $w after saving them"; continue; fi
    log "    saved: units $u $w"
    launch "dev/db" || { result "FAIL  db $s: app did not open after the kill"; return; }
    if ! dump >"$dir/db-$u.xml"; then ok=0; log "    could not read the screen"; continue; fi
    for want in "user_version $SCHEMA_VERSION" "journal wal" "$DB_TABLES" "units $u $w" "failure armed no"; do
      if has_text "$dir/db-$u.xml" "$want"; then log "    after kill and restart: $want"
      else ok=0; log "    MISSING after kill and restart: $want"; fi
    done
  done
  # T-011: the pit-legacy module reads the 0.2.0 app's CapacitorStorage preferences on a real build. None
  # yet; then (emulator only) a file shaped like the Capacitor app's, read after a restart and removed again.
  has_text "$dir/db-F.xml" "legacy prefs none" || { ok=0; log "    MISSING: legacy prefs none"; }
  if is_emulator; then
    A shell am force-stop "$PKG"
    A shell run-as "$PKG" sh -c "'mkdir -p shared_prefs && cat >shared_prefs/CapacitorStorage.xml'" <<'XML'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="settings">{&quot;temp&quot;:&quot;F&quot;,&quot;weight&quot;:&quot;lb&quot;}</string>
    <string name="gear">{}</string>
</map>
XML
    if launch "dev/db" && dump >"$dir/db-legacy.xml" && has_text "$dir/db-legacy.xml" "legacy prefs gear, settings"; then
      log "    legacy prefs gear, settings (read from a CapacitorStorage file)"
    else
      ok=0; log "    MISSING: legacy prefs gear, settings"
    fi
    A shell am force-stop "$PKG"
    A shell run-as "$PKG" rm -f shared_prefs/CapacitorStorage.xml
    launch "dev/db" || ok=0
  fi
  shot "$dir/db.png"
  if [ $ok = 1 ]; then result "PASS  db $s"; else result "FAIL  db $s"; fi
}

# T-010: a forced migration failure (dev builds only; armed from the dev database screen, used up by the next
# start) shows the error screen instead of the app. The title, body and Export my data show, the details only
# after Show details; Export my data opens the Android share sheet (checked by window focus and closed again:
# it lists other apps, so it is never dumped or photographed); the start after that is normal, with the
# version and the data as they were.
test_migration_error() {
  local s="$1" dir="$2" ok=1 units focus want
  miss() { ok=0; log "    MISSING: $1"; }
  launch "dev/db?fail=1" || { result "FAIL  migration-error $s: app did not open"; return; }
  dump >"$dir/error-armed.xml" || { result "FAIL  migration-error $s: could not read the screen"; return; }
  has_text "$dir/error-armed.xml" "failure armed yes" || miss "failure armed yes"
  units=$(grep -oE 'text="units [CF] (kg|lb)"' "$dir/error-armed.xml" | head -n 1)

  launch "" || { result "FAIL  migration-error $s: app did not open"; return; }
  dump >"$dir/error.xml" || { result "FAIL  migration-error $s: could not read the error screen"; return; }
  has_text "$dir/error.xml" "$ERROR_TITLE" || miss "the title"
  has_text "$dir/error.xml" "$ERROR_BODY" || miss "the body"
  grep -q 'Export my data' "$dir/error.xml" || miss "Export my data"
  grep -q 'Show details' "$dir/error.xml" || miss "Show details"
  if grep -q 'Forced by' "$dir/error.xml"; then ok=0; log "    details are showing before Show details"; fi
  if grep -q 'content-desc="Plan"' "$dir/error.xml"; then ok=0; log "    the app's tabs are showing"; fi
  shot "$dir/migration-error.png"

  tap "Show details" 1 | tee -a "$REPORT"
  dump >"$dir/error-details.xml" || miss "the screen after Show details"
  grep -q 'migration [0-9]* (forced_failure) failed: Forced by the dev database screen' "$dir/error-details.xml" ||
    miss "the error details"
  shot "$dir/migration-error-details.png"

  tap "Export my data" 1 | tee -a "$REPORT"
  sleep 2
  focus=$(A shell dumpsys window | grep -m1 mCurrentFocus | tr -d '\r')
  if [[ "$focus" =~ intentresolver|ChooserActivity|ResolverActivity ]]; then log "    Export my data: share sheet opened"
  else ok=0; log "    Export my data: no share sheet (focus: ${focus##*mCurrentFocus=})"; fi
  A shell input keyevent KEYCODE_BACK
  sleep 1

  launch "dev/db" || { result "FAIL  migration-error $s: app did not open after the failure"; return; }
  dump >"$dir/error-after.xml" || miss "the screen after the failure"
  for want in "user_version $SCHEMA_VERSION" "$DB_TABLES" "failure armed no"; do
    has_text "$dir/error-after.xml" "$want" || miss "after the failure: $want"
  done
  [ -n "$units" ] && grep -qF "$units" "$dir/error-after.xml" || miss "after the failure: the same ${units:-units}"
  if [ $ok = 1 ]; then result "PASS  migration-error $s"; else result "FAIL  migration-error $s"; fi
}

# T-010 follow-up: a database file that cannot be opened at all (not a database) shows the same screen, and
# Export my data shares the database files (one tar). Emulator only: the test swaps the dev build's database for a text
# file and puts the real one back afterwards (also when a step fails).
test_db_unopenable() {
  local s="$1" dir="$2" ok=1 units focus dbdir=files/SQLite
  miss() { ok=0; log "    MISSING: $1"; }
  if ! is_emulator; then log "    db-unopenable runs on the emulator only; skipped"; return; fi
  launch "dev/db" || { result "FAIL  db-unopenable $s: app did not open"; return; }
  dump >"$dir/unopenable-before.xml" || { result "FAIL  db-unopenable $s: could not read the screen"; return; }
  units=$(grep -oE 'text="units [CF] (kg|lb)"' "$dir/unopenable-before.xml" | head -n 1)
  A shell am force-stop "$PKG"
  A shell run-as "$PKG" sh -c "'cd $dbdir && mkdir ../db-aside && mv pitplanner.db* ../db-aside/ && echo not-a-database-not-a-database >pitplanner.db'" ||
    { result "FAIL  db-unopenable $s: could not swap the database file"; return; }
  put_back() {
    A shell am force-stop "$PKG"
    A shell run-as "$PKG" sh -c "'cd $dbdir && rm -f pitplanner.db pitplanner.db-wal pitplanner.db-shm pitplanner.db-journal && mv ../db-aside/* . && rmdir ../db-aside'"
  }
  if launch "" && dump >"$dir/unopenable.xml"; then
    has_text "$dir/unopenable.xml" "$ERROR_TITLE" || miss "the title"
    tap "Show details" 1 | tee -a "$REPORT"
    dump >"$dir/unopenable-details.xml" || miss "the screen after Show details"
    grep -q 'the database could not be opened' "$dir/unopenable-details.xml" || miss "the error details"
    shot "$dir/db-unopenable.png"
    tap "Export my data" 1 | tee -a "$REPORT"
    sleep 2
    focus=$(A shell dumpsys window | grep -m1 mCurrentFocus | tr -d '\r')
    if [[ "$focus" =~ intentresolver|ChooserActivity|ResolverActivity ]]; then log "    Export my data: share sheet opened for the database files"
    else ok=0; log "    Export my data: no share sheet (focus: ${focus##*mCurrentFocus=})"; fi
    A shell input keyevent KEYCODE_BACK
    sleep 1
  else
    miss "the error screen"
  fi
  put_back || { result "FAIL  db-unopenable $s: could not put the database back"; return; }
  if launch "dev/db" && dump >"$dir/unopenable-after.xml"; then
    has_text "$dir/unopenable-after.xml" "user_version $SCHEMA_VERSION" || miss "after: user_version $SCHEMA_VERSION"
    [ -n "$units" ] && grep -qF "$units" "$dir/unopenable-after.xml" || miss "after: the same ${units:-units}"
  else
    miss "the app after the database was put back"
  fi
  if [ $ok = 1 ]; then result "PASS  db-unopenable $s"; else result "FAIL  db-unopenable $s"; fi
}

# T-012: the first start over 0.2.0 data. Emulator only. The dev build's database is set aside, files shaped
# like a 0.2.0 install (tools/device/fixtures/legacy-020: CapacitorStorage.xml through the real pit-legacy
# module, files/history.json through expo-file-system) are put in place, and the app starts on an empty
# database. Three cases, each with its own one-time notice: everything readable; a corrupted gear entry;
# nothing readable. Afterwards the test's files are removed and the database is put back.
test_legacy_import() {
  local s="$1" dir="$2" ok=1 case body fx="$DEVICE_DIR/fixtures/legacy-020" files
  miss() { ok=0; log "    $case MISSING: $1"; }
  if ! is_emulator; then log "    legacy-import runs on the emulator only; skipped"; return; fi
  as_app() { A shell run-as "$PKG" sh -c "'$1'"; }
  clean() { as_app "rm -rf files/SQLite files/history.json files/history.json.imported shared_prefs/CapacitorStorage.xml shared_prefs/CapacitorStorage.imported.xml"; }
  A shell am force-stop "$PKG"
  as_app "mkdir import-aside && mv files/SQLite import-aside/" ||
    { result "FAIL  legacy-import $s: could not set the database aside"; return; }
  for case in full partial fresh; do
    A shell am force-stop "$PKG"
    clean
    as_app "mkdir -p shared_prefs && cat >shared_prefs/CapacitorStorage.xml" <"$fx/$case/CapacitorStorage.xml"
    as_app "cat >files/history.json" <"$fx/$case/history.json"
    if ! launch "dev/db" || ! dump >"$dir/import-$case.xml"; then miss "the app"; continue; fi
    case $case in
      full) body="Your smokers, cook rates, plan and history came over." ;;
      partial) body="Some of your old settings couldn't be read. Check Gear before your next cook." ;;
      fresh) body="Your old data couldn't be brought over. Set up your smoker in Gear to start." ;;
    esac
    has_text "$dir/import-$case.xml" "Pit Planner has a new look" || miss "the notice"
    has_text "$dir/import-$case.xml" "$body" || miss "the sentence: $body"
    shot "$dir/import-$case.png"
    tap "OK" 1 | tee -a "$REPORT"
    # Closed once, it never shows again.
    launch "dev/db" && dump >"$dir/import-$case.xml" || miss "the app after OK"
    if grep -q "Pit Planner has a new look" "$dir/import-$case.xml"; then ok=0; log "    $case: the notice showed a second time"; fi
    files=$(as_app "ls shared_prefs files" | tr -d '\r' | tr '\n' ' ')
    case $case in
      full)
        has_text "$dir/import-full.xml" "import done" || miss "import done"
        has_text "$dir/import-full.xml" "data cookers 3, rates 2, cooks 2, plan items 1" || miss "the imported data"
        has_text "$dir/import-full.xml" "units F lb" || miss "units"
        has_text "$dir/import-full.xml" "legacy prefs none" || miss "the old prefs emptied"
        # T-015: the cook that came across is running, so its step alarms are set at this first start.
        if launch "dev/alarm" && dump >"$dir/import-full-alarms.xml" &&
          grep -qE 'text="stored alarms [1-9][0-9]*, repeats 0"' "$dir/import-full-alarms.xml"; then
          log "    full: $(grep -oE 'stored alarms [0-9]+' "$dir/import-full-alarms.xml" | head -n 1) for the imported cook"
        else miss "the imported cook's alarms"; fi
        [[ "$files" == *"CapacitorStorage.imported.xml"* ]] || miss "the kept copy of the prefs"
        [[ "$files" == *"history.json.imported"* ]] || miss "the kept history file"
        ;;
      partial)
        has_text "$dir/import-partial.xml" "import partial" || miss "import partial"
        has_text "$dir/import-partial.xml" "data cookers 0, rates 2, cooks 2, plan items 1" || miss "the imported data"
        grep -q 'text="legacy prefs [a-zA-Z, ]*gear' "$dir/import-partial.xml" || miss "the old prefs kept"
        [[ " $files " == *" history.json "* ]] || miss "the old history file kept"
        ;;
      fresh)
        has_text "$dir/import-fresh.xml" "import fresh" || miss "import fresh"
        has_text "$dir/import-fresh.xml" "data cookers 0, rates 0, cooks 0, plan items 0" || miss "an empty start"
        [[ " $files " == *" history.json "* ]] || miss "the old history file kept"
        ;;
    esac
    [ $ok = 1 ] && log "    $case: as expected"
  done
  A shell am force-stop "$PKG"
  clean
  as_app "mv import-aside/SQLite files/ && rmdir import-aside" ||
    { result "FAIL  legacy-import $s: could not put the database back"; return; }
  if launch "dev/db" && dump >"$dir/import-after.xml" && has_text "$dir/import-after.xml" "user_version $SCHEMA_VERSION"; then :
  else miss "the app after the database was put back"; fi
  # The database put back has no running cook: the start above cleared the test cook's alarms from the phone
  # (`dumpsys alarm` is no help here: its history keeps naming alarms that are gone).
  if launch "dev/alarm" && dump >"$dir/import-after-alarms.xml" && has_text "$dir/import-after-alarms.xml" "stored alarms 0, repeats 0"; then :
  else miss "the test cook's alarms cleared"; fi
  if [ $ok = 1 ]; then result "PASS  legacy-import $s"; else result "FAIL  legacy-import $s"; fi
}

# T-013, T-016: a test alarm through the real path (pit-alarms: setAlarmClock, AlarmReceiver, the step notification)
# rings with the screen off. Emulator only: the notification is read from `dumpsys notification`, which on
# the phone would list other apps'. The dev alarm screen (pitplanner://dev/alarm) sets the alarm 20 s out
# with a title unique to this run; the screen is turned off; the notification must be posted on the step
# channel; afterwards nothing is left stored and nothing repeats (test alarms do not).
test_alarm() {
  local s="$1" dir="$2" ok=1 tag posted="" want
  miss() { ok=0; log "    MISSING: $1"; }
  if ! is_emulator; then log "    alarm runs on the emulator only; skipped"; return; fi
  tag="$(date +%s)"
  posted_now() { # $1: the title's tag
    A shell dumpsys notification --noredact </dev/null | grep -A60 "NotificationRecord.*pkg=$PKG " |
      grep -q "android.title=String (Test alert $1)"
  }
  A shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS
  launch "dev/alarm?test=20:$tag" || { result "FAIL  alarm $s: app did not open"; return; }
  dump >"$dir/alarm-set.xml" || { result "FAIL  alarm $s: could not read the screen"; return; }
  for want in "test alarm set, exact yes" "notifications on" "exact alarms on" "stored alarms 1, repeats 0"; do
    has_text "$dir/alarm-set.xml" "$want" || miss "$want"
  done
  if posted_now "$tag"; then miss "a screen-off ring (the alarm rang before the screen was off)"; fi
  A shell input keyevent KEYCODE_SLEEP
  sleep 1
  A shell dumpsys power </dev/null | grep -q "mWakefulness=Asleep" || miss "the screen off"
  for _ in $(seq 40); do
    if posted_now "$tag"; then posted=1; break; fi
    sleep 1
  done
  if [ -n "$posted" ]; then log "    rang with the screen off: Test alert $tag"; else miss "the notification"; fi

  # Doze (T-016): a second test alarm rings with the emulator forced into deep idle (battery reported
  # unplugged, screen off) and the app off the battery allowlist. Android (16: one hour) will not enter deep
  # idle while an alarm clock is that close (DeviceIdleController's min_time_to_alarm), so the test shortens
  # that window to 1 s as root for its duration: what it proves is that an alarm set with setAlarmClock is
  # delivered on time to a device that is in deep idle. The window, the allowlist entry, idle and battery are
  # put back here and again on exit (restore).
  local listed="" idle forced
  A root >/dev/null
  A wait-for-device
  A shell dumpsys deviceidle whitelist </dev/null | grep -q "$PKG" && listed=1
  A shell dumpsys deviceidle whitelist "-$PKG" >/dev/null
  A shell device_config put device_idle min_time_to_alarm 1000
  A shell input keyevent KEYCODE_WAKEUP
  A shell wm dismiss-keyguard
  if launch "dev/alarm?test=45:$tag-doze"; then
    A shell dumpsys battery unplug
    A shell input keyevent KEYCODE_SLEEP
    sleep 2
    forced=$(A shell dumpsys deviceidle force-idle | tr -d '\r')
    idle=$(A shell dumpsys deviceidle get deep | tr -d '\r')
    # Forced in, Android may already be in the idle cycle's maintenance window: it ends an idle period ahead
    # of an alarm clock on purpose (AlarmManager clamps "idle until" to the next wake-from-idle alarm).
    [[ "$forced" == *"Now forced in to deep idle mode"* ]] || miss "forcing deep idle ($forced)"
    case "$idle" in IDLE | IDLE_MAINTENANCE) ;; *) miss "the deep idle cycle with the alarm pending ($idle)" ;; esac
    posted=""
    for _ in $(seq 70); do
      if posted_now "$tag-doze"; then posted=1; break; fi
      sleep 1
    done
    if [ -n "$posted" ]; then log "    rang after deep idle was forced (state $idle), off the battery allowlist: Test alert $tag-doze"
    else miss "the notification in Doze"; fi
  else miss "the app for the Doze alarm"; fi
  A shell device_config delete device_idle min_time_to_alarm >/dev/null
  A shell dumpsys deviceidle unforce >/dev/null
  A shell dumpsys battery reset
  [ -n "$listed" ] && A shell dumpsys deviceidle whitelist "+$PKG" >/dev/null
  A shell dumpsys notification --noredact </dev/null | grep -A60 "NotificationRecord.*pkg=$PKG " |
    grep -q "channel=steps_v1" || miss "the step channel"
  A shell input keyevent KEYCODE_WAKEUP
  A shell wm dismiss-keyguard
  if launch "dev/alarm" && dump >"$dir/alarm-after.xml"; then
    has_text "$dir/alarm-after.xml" "stored alarms 0, repeats 0" || miss "stored alarms 0, repeats 0"
  else miss "the app after the alarm"; fi
  # T-015: the hidden alarm test screen lists what is stored and rings a test alert in 10 s. With food on
  # the plan it lists every step first and the rest is off screen, so the plan is emptied (dev seed).
  launch "dev/plan?seed=empty" >/dev/null
  if launch "debug" && dump >"$dir/debug.xml"; then
    has_text "$dir/debug.xml" "Alarm tests" || miss "the Alarm tests screen"
    has_text "$dir/debug.xml" "Notifications on" || miss "Notifications on"
    has_text "$dir/debug.xml" "Nothing scheduled." || miss "Nothing scheduled."
    tap "Send a test alert in 10 sec" 1 | tee -a "$REPORT"
    dump >"$dir/debug-set.xml" && grep -q 'text="[^"]*Test alert (test) (critical)"' "$dir/debug-set.xml" || miss "the test alert in the stored list"
    sleep 12
    tap "Refresh" 1 | tee -a "$REPORT"
    dump >"$dir/debug-rang.xml" && has_text "$dir/debug-rang.xml" "Nothing scheduled." || miss "the test alert gone from the list after it rang"
  else miss "the debug screen"; fi
  if [ $ok = 1 ]; then result "PASS  alarm $s"; else result "FAIL  alarm $s"; fi
}

# T-017: the Plan tab against mockups 05 (the menu) and 04 (empty). The dev plan seed puts the mockup's menu
# on the plan. Checked: the parts are there; what must show whole above the pinned Start cook without
# scrolling (plan_fit); the three tiles share their row in equal widths within 1 dp (PR-4); the empty plan
# offers Cook a past plan again only when there is a past cook. Screenshots for docs/fidelity (the avatars,
# PR-2, are judged there).

# The strip over the content above a pinned button where the kit fades the content out: FOOT_FADE.height in
# src/components/kit/sheet.tsx (32 dp) plus the 2 dp between the fade and the button. A control that ends in
# it is dimmed, so it only counts as fitting when it ends above it (Jason's T-017 review, 2026-11-13).
FOOT_FADE_DP=34
PLAN_PARTS=("Brisket, edit" "Chicken wings, edit" "Chicken breasts, edit" "Add food")
plan_miss() { ok=0; log "    MISSING: $1"; }
plan_problems() { local line; while IFS= read -r line; do [ -n "$line" ] && { ok=0; log "    $line"; }; done <<<"$1"; }
has_label() { grep -qF "content-desc=\"$2\"" "$1"; }
# Jason's fit targets (HANDOFF "Decisions", set 2026-11-14): at 115% and at 130% two cards whole above Start
# cook and its fade, without scrolling. At 115% the third card may end in the fade and Add food is reached by
# scrolling. Logs how much room every part has, then fails the caller (its
# `ok`) for a target that is missed. Used with gesture navigation (plan) and 3-button navigation (plan-3button).
plan_fit() {
  local s="$1" xml="$2" px fade out line fit
  px=$(($(A shell wm density | grep -oE '[0-9]+$' | tail -n 1) / 160))
  fade=$((FOOT_FADE_DP * px))
  while IFS= read -r line; do log "    $line"; done < <(node check.mjs room "$xml" "Start cook" "$fade" "$px" "${PLAN_PARTS[@]}")
  case "$s" in
    1.15 | 1.3) fit=("${PLAN_PARTS[@]:0:2}") ;;
    *) fit=() ;;
  esac
  [ ${#fit[@]} -gt 0 ] || return 0
  if out=$(node check.mjs above "$xml" "Start cook" "$fade" "${fit[@]}"); then
    log "    whole above Start cook and its fade without scrolling: ${fit[*]}"
  else
    log "    FIT TARGET MISSED at $s:"
    plan_problems "$out"
  fi
}

test_plan() {
  local s="$1" dir="$2" ok=1 want out dp
  launch "dev/plan?seed=mockup" || { result "FAIL  plan $s: app did not open"; return; }
  sleep 1
  dump >"$dir/plan-main.xml" || { result "FAIL  plan $s: could not read the screen"; return; }
  for want in "Plan" "On the menu"; do has_text "$dir/plan-main.xml" "$want" || plan_miss "$want"; done
  grep -qE 'text="3.items"' "$dir/plan-main.xml" || plan_miss "3 items" # a Num: its space is a no-break space
  for want in "Share plan" "Ready by" "Start at" "Pick date and time" "Change date and time" "Smoker temp" \
    "Brisket, edit" "Start cook"; do
    has_label "$dir/plan-main.xml" "$want" || plan_miss "$want"
  done
  plan_fit "$s" "$dir/plan-main.xml"
  shot "$dir/plan-main.png"
  # The date and time open the system's date dialog, then its time dialog; OK on both keeps the time.
  tap "Change date and time" 1 | tee -a "$REPORT"
  if dump >"$dir/plan-date.xml" && grep -qE 'text="OK"' "$dir/plan-date.xml" && grep -qiE 'text="cancel"' "$dir/plan-date.xml"; then
    tap "OK" 1 | tee -a "$REPORT"
    if dump >"$dir/plan-time.xml" && grep -qE 'text="OK"' "$dir/plan-time.xml"; then
      tap "OK" 1 | tee -a "$REPORT"
      dump >"$dir/plan-picked.xml" && has_label "$dir/plan-picked.xml" "Change date and time" || plan_miss "Plan after the pickers"
      log "    date dialog, then time dialog, then back on Plan"
    else plan_miss "the time dialog"; fi
  else plan_miss "the date dialog"; fi
  # The tiles are the end of the list: scroll to them, then measure.
  scroll_bottom | tee -a "$REPORT"
  dump >"$dir/plan-tiles.xml" || plan_miss "the screen after scrolling"
  dp=$(A shell wm density | grep -oE '[0-9]+$' | tail -n 1)
  if out=$(node check.mjs widths "$dir/plan-tiles.xml" "$((dp / 160))" "Fire smoker" "Pellets" "Conflicts"); then
    log "    tiles: equal widths on one row (within 1 dp)"
  else plan_problems "$out"; fi
  # Scrolled to the end, the tiles sit whole above Start cook and its fade.
  if out=$(node check.mjs above "$dir/plan-tiles.xml" "Start cook" "$((FOOT_FADE_DP * dp / 160))" "Fire smoker 6:20 AM"); then
    log "    scrolled to the end: the tiles end above Start cook and its fade"
  else plan_problems "$out"; fi
  shot "$dir/plan-tiles.png"

  # Empty plan with a past cook (the seed adds one): Cook a past plan again shows. Then with none (the empty
  # seed takes the seeded cook away again): it is not there (Jason's T-017 review, 2026-11-13).
  launch "dev/plan?seed=past" || { result "FAIL  plan $s: app did not open (past cook)"; return; }
  sleep 1
  dump >"$dir/plan-past.xml" || { result "FAIL  plan $s: could not read the empty screen (past cook)"; return; }
  for want in "Add food" "Cook a past plan again"; do
    has_label "$dir/plan-past.xml" "$want" || plan_miss "$want (with a past cook)"
  done
  shot "$dir/plan-past.png"
  launch "dev/plan?seed=empty" || { result "FAIL  plan $s: app did not open (empty)"; return; }
  sleep 1
  dump >"$dir/plan-empty.xml" || { result "FAIL  plan $s: could not read the empty screen"; return; }
  has_text "$dir/plan-empty.xml" "What are we cooking?" || plan_miss "What are we cooking?"
  for want in "Add food" "Change date and time"; do
    has_label "$dir/plan-empty.xml" "$want" || plan_miss "$want"
  done
  if has_label "$dir/plan-empty.xml" "Cook a past plan again"; then ok=0; log "    Cook a past plan again shows with no past cook"; fi
  if has_label "$dir/plan-empty.xml" "Start cook"; then ok=0; log "    Start cook shows on the empty plan"; fi
  shot "$dir/plan-empty.png"
  if [ $ok = 1 ]; then result "PASS  plan $s"; else result "FAIL  plan $s"; fi
}

# Jason, 2026-11-13: the same fit check with 3-button navigation on (a 48 dp bar under the tab bar, where
# gesture navigation has 24 dp). Emulator only: the phone's navigation mode is Jason's and is never changed.
test_plan_3button() {
  local s="$1" dir="$2" ok=1
  if ! is_emulator; then result "SKIP  plan-3button $s: emulator only"; return; fi
  if nav_mode threebutton; then
    if launch "dev/plan?seed=mockup" && sleep 1 && dump >"$dir/plan-3button.xml"; then
      has_label "$dir/plan-3button.xml" "Start cook" || plan_miss "Start cook"
      plan_fit "$s" "$dir/plan-3button.xml"
      shot "$dir/plan-3button.png"
    else plan_miss "Plan (the app did not open or could not be read)"; fi
  else plan_miss "3-button navigation (could not switch)"; fi
  nav_back || { ok=0; log "    could not switch the navigation mode back"; }
  if [ $ok = 1 ]; then result "PASS  plan-3button $s"; else result "FAIL  plan-3button $s"; fi
}

read -r -a SCALES <<<"${DEVICE_SCALES:-1.15 1.3}"
for s in "${SCALES[@]}"; do
  A shell settings put system font_scale "$s"
  dir="$OUT/$s"
  mkdir -p "$dir"
  log "== font scale $s"
  for ((round = 1; round <= REPEAT; round++)); do
    [ "$REPEAT" = 1 ] || log "-- round $round of $REPEAT"
    for t in "${TESTS[@]}"; do "test_${t//-/_}" "$s" "$dir"; done
  done
done

# --- images and summary -----------------------------------------------------------------------------------
IMAGES=()
if [[ " ${TESTS[*]} " == *" smoke "* ]]; then
  python3 -I compose.py "$OUT/smoke.png" "Plan 115%=$OUT/1.15/plan.png" "Cook=$OUT/1.15/cook.png" \
    "Gear=$OUT/1.15/gear.png" "Plan 130%=$OUT/1.3/plan.png" "Cook=$OUT/1.3/cook.png" "Gear=$OUT/1.3/gear.png" &&
    IMAGES+=("$OUT/smoke.png")
fi
if [[ " ${TESTS[*]} " == *" sheet-keyboard "* ]]; then
  python3 -I compose.py "$OUT/sheet-keyboard.png" "Weight 115%=$OUT/1.15/sheet-keyboard-Weight.png" \
    "Name 115%=$OUT/1.15/sheet-keyboard-Name.png" "Weight 130%=$OUT/1.3/sheet-keyboard-Weight.png" \
    "Name 130%=$OUT/1.3/sheet-keyboard-Name.png" && IMAGES+=("$OUT/sheet-keyboard.png")
fi
if [[ " ${TESTS[*]} " == *" migration-error "* ]]; then
  python3 -I compose.py "$OUT/migration-error.png" "Error 115%=$OUT/1.15/migration-error.png" \
    "Details 115%=$OUT/1.15/migration-error-details.png" "Error 130%=$OUT/1.3/migration-error.png" \
    "Details 130%=$OUT/1.3/migration-error-details.png" && IMAGES+=("$OUT/migration-error.png")
fi
if [[ " ${TESTS[*]} " == *" legacy-import "* ]] && [ -f "$OUT/1.15/import-partial.png" ]; then
  python3 -I compose.py "$OUT/legacy-import.png" "Full 115%=$OUT/1.15/import-full.png" \
    "Partial 115%=$OUT/1.15/import-partial.png" "Fresh 115%=$OUT/1.15/import-fresh.png" \
    "Full 130%=$OUT/1.3/import-full.png" "Partial 130%=$OUT/1.3/import-partial.png" \
    "Fresh 130%=$OUT/1.3/import-fresh.png" && IMAGES+=("$OUT/legacy-import.png")
fi
if [[ " ${TESTS[*]} " == *" plan "* ]]; then
  plan_imgs=()
  empty_imgs=()
  for s in "${SCALES[@]}"; do
    pct=$(awk -v s="$s" 'BEGIN { printf "%d", s * 100 + 0.5 }')
    plan_imgs+=("Plan $pct%=$OUT/$s/plan-main.png" "Tiles $pct%=$OUT/$s/plan-tiles.png")
    empty_imgs+=("Empty $pct%=$OUT/$s/plan-empty.png" "Past cook $pct%=$OUT/$s/plan-past.png")
  done
  python3 -I compose.py "$OUT/plan.png" "${plan_imgs[@]}" && IMAGES+=("$OUT/plan.png")
  python3 -I compose.py "$OUT/plan-empty.png" "${empty_imgs[@]}" && IMAGES+=("$OUT/plan-empty.png")
fi
if [[ " ${TESTS[*]} " == *" plan-3button "* ]]; then
  nav_imgs=()
  for s in "${SCALES[@]}"; do
    pct=$(awk -v s="$s" 'BEGIN { printf "%d", s * 100 + 0.5 }')
    [ -f "$OUT/$s/plan-3button.png" ] && nav_imgs+=("3-button $pct%=$OUT/$s/plan-3button.png")
  done
  [ ${#nav_imgs[@]} -eq 0 ] || { python3 -I compose.py "$OUT/plan-3button.png" "${nav_imgs[@]}" && IMAGES+=("$OUT/plan-3button.png"); }
fi
log ""
log "=== device summary ==="
printf '%s\n' "${RESULTS[@]}" | tee -a "$REPORT"
[ ${#IMAGES[@]} -eq 0 ] || log "images: ${IMAGES[*]}"
! printf '%s\n' "${RESULTS[@]}" | grep -q '^FAIL'
