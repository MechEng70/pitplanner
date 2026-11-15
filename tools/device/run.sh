#!/bin/bash
# One unattended device pass on the dev build (TASKS T-006).
#   npm run device -- [--phone] [--no-build] [--repeat N] [--only <test>]...
#   tests: smoke, sheet-keyboard, stable-controls, db, migration-error, db-unopenable, legacy-import, alarm,
#   plan, plan-3button, plan-sheets, food-details, survive, cook
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

ALL=(smoke sheet-keyboard stable-controls db migration-error db-unopenable legacy-import alarm plan plan-3button plan-sheets food-details survive cook)
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
  # The survive test turns "Don't keep activities" on (emulator only): never leave it on.
  if is_emulator; then A shell settings put global always_finish_activities 0 >/dev/null 2>&1; fi
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

# T-018: what opens from Plan. The smoker temp menu (mockup 06): the opened field sits exactly over the field
# that opened it, the rows are the smoker's own steps with fire times, and after a choice the field has the new
# temp and neither it nor anything above it has moved (PR-3). Add food (mockup 07): the list, the search, and a
# chosen food lands on the menu. Conflicts: the sheet lists the conflict and Move to the griddle clears it.
test_plan_sheets() {
  local s="$1" dir="$2" ok=1 want before open
  launch "dev/plan?seed=mockup" || { result "FAIL  plan-sheets $s: app did not open"; return; }
  sleep 1
  dump >"$dir/sheets-plan.xml" || { result "FAIL  plan-sheets $s: could not read the screen"; return; }
  before=$(node check.mjs center "$dir/sheets-plan.xml" "Smoker temp")
  tap "Smoker temp" 1 | tee -a "$REPORT"
  if dump >"$dir/sheets-temp.xml"; then
    open=$(node check.mjs center "$dir/sheets-temp.xml" "Smoker temp")
    [ -n "$before" ] && [ "$before" = "$open" ] || plan_miss "the opened field over the field (was $before, is $open)"
    has_text "$dir/sheets-temp.xml" "Pit Boss 820 sets in 5F steps. Times for 12 lb brisket." || plan_miss "the menu's intro"
    for want in 215F 220F 225F 230F; do grep -qE "text=\"$want\"" "$dir/sheets-temp.xml" || plan_miss "the $want row"; done
    grep -qE 'text="fire.6:20.AM"' "$dir/sheets-temp.xml" || plan_miss "fire 6:20 AM on the 225F row"
    grep -qE 'text="Show.180-500F"|content-desc="Show.180-500F"' "$dir/sheets-temp.xml" || plan_miss "Show 180-500F"
    shot "$dir/sheets-temp.png"
    tap "230F" 1 | tee -a "$REPORT"
    if dump >"$dir/sheets-picked.xml"; then
      grep -qE 'text="230F"' "$dir/sheets-picked.xml" || plan_miss "230F in the field after the choice"
      grep -qE 'text="fire' "$dir/sheets-picked.xml" && plan_miss "the menu closed after the choice"
      if out=$(node check.mjs stable "$dir/sheets-plan.xml" "$dir/sheets-picked.xml" "Smoker temp"); then
        log "    after the choice: the field and everything above it are where they were (PR-3)"
      else plan_problems "$out"; fi
    else plan_miss "Plan after the temp choice"; fi
  else plan_miss "the temp menu"; fi

  # At 115% and up Add food is behind Start cook until the list is scrolled (Jason's target, 2026-11-14): a
  # tap there would land on Start cook. Scrolled to the end it is above the tiles, clear of the button.
  scroll_bottom | tee -a "$REPORT"
  tap "Add food" 1 | tee -a "$REPORT"
  if dump >"$dir/sheets-food.xml"; then
    for want in "Add food" "Beef" "Brisket" "Tri-tip" "Pork" "St. Louis ribs" "Smoker, by weight"; do
      has_text "$dir/sheets-food.xml" "$want" || plan_miss "$want on Add food"
    done
    has_label "$dir/sheets-food.xml" "Search foods" || plan_miss "Search foods"
    shot "$dir/sheets-food.png"
    # T-019: the food opens in food details first and goes on the menu on Add to plan.
    tap "Tri-tip" 1 | tee -a "$REPORT"
    dump >"$dir/sheets-new.xml" && has_label "$dir/sheets-new.xml" "Add to plan" || plan_miss "food details for tri-tip, with Add to plan"
    tap "Add to plan" 1 | tee -a "$REPORT"
    dump >"$dir/sheets-added.xml" && grep -qE 'text="4.items"' "$dir/sheets-added.xml" || plan_miss "4 items after adding tri-tip"
  else plan_miss "the Add food sheet"; fi

  launch "dev/plan?seed=clash" || { result "FAIL  plan-sheets $s: app did not open (clash)"; return; }
  sleep 1
  scroll_bottom | tee -a "$REPORT"
  tap "Conflicts 1" 1 | tee -a "$REPORT"
  if dump >"$dir/sheets-issues.xml"; then
    has_text "$dir/sheets-issues.xml" "Conflicts" || plan_miss "the Conflicts sheet"
    has_text "$dir/sheets-issues.xml" "2 lb chicken wings 1 needs 225F while 2 lb chicken wings 2 needs 350F at the same time." ||
      plan_miss "the conflict's message"
    for want in "Move 2 lb chicken wings 1 to the griddle" "Move 2 lb chicken wings 2 to the griddle" \
      "Change smoker temp" "Edit 2 lb chicken wings 1" "Edit 2 lb chicken wings 2"; do
      has_label "$dir/sheets-issues.xml" "$want" || has_text "$dir/sheets-issues.xml" "$want" || plan_miss "$want"
    done
    shot "$dir/sheets-issues.png"
    tap "Move 2 lb chicken wings 1 to the griddle" 1 | tee -a "$REPORT"
    dump >"$dir/sheets-fixed.xml" && has_text "$dir/sheets-fixed.xml" "Nothing to fix. The plan fits your cookers." ||
      plan_miss "Nothing to fix after the move"
  else plan_miss "the Conflicts sheet"; fi
  if [ $ok = 1 ]; then result "PASS  plan-sheets $s"; else result "FAIL  plan-sheets $s"; fi
}

# T-019 Food details (mockups 08-10), opened by the dev seed for a new brisket, ribs and chicken breasts on
# the empty plan (brisket rate 0.75 hr/lb saved). The result bar is pinned above Add to plan with fire, off
# heat and serve; a rate tap changes its times and leaves its bounds alone; a tap on it brings the full
# result card into view, whole above the bar. The no-scroll checks are the `food` targets of stable-controls.
BAR_BRISKET="Fire 6:20 AM, Off heat 3:40 PM, Serve 5:00 PM"
test_food_details() {
  local s="$1" dir="$2" ok=1 want before after bar_top
  launch "dev/plan?seed=empty&add=brisket" || { result "FAIL  food-details $s: app did not open"; return; }
  sleep 1
  dump >"$dir/food-brisket.xml" || { result "FAIL  food-details $s: could not read the screen"; return; }
  for want in "Brisket" "Trimmed weight" "Cook on" "Wrap at the stall" "Rest after pull"; do
    has_text "$dir/food-brisket.xml" "$want" || plan_miss "$want"
  done
  for want in "More trimmed weight" "Less trimmed weight" "Butcher paper" "Add to plan" "$BAR_BRISKET"; do
    has_label "$dir/food-brisket.xml" "$want" || plan_miss "$want"
  done
  has_label "$dir/food-brisket.xml" "Remove" && plan_miss "no Remove on a new food (it shows)"
  shot "$dir/food-brisket.png"
  # As opened, the rate stepper is behind the bar and the buttons: scrolled to the end it is clear of them.
  scroll_bottom | tee -a "$REPORT"
  on_screen "More hours per pound" UP
  if dump >"$dir/food-rate-before.xml"; then
    before=$(node check.mjs bounds "$dir/food-rate-before.xml" "Fire ")
    tap "More hours per pound" 1 | tee -a "$REPORT"
    dump >"$dir/food-rate-after.xml" || plan_miss "the screen after a rate tap"
    after=$(node check.mjs bounds "$dir/food-rate-after.xml" "Fire ")
    if [ -n "$before" ] && [ "$before" = "$after" ]; then log "    result bar: same bounds after a rate tap ($after)"
    else plan_miss "the result bar where it was after a rate tap (was $before, is $after)"; fi
    has_label "$dir/food-rate-after.xml" "$BAR_BRISKET" && plan_miss "new times in the result bar after a rate tap"
    tap "Less hours per pound" 1 | tee -a "$REPORT"
  else plan_miss "the hours per pound stepper"; fi
  # Back to the top, then the bar: the only scroll on this screen, and the user starts it.
  on_screen "More trimmed weight" UP
  tap "Fire .*" 1 | tee -a "$REPORT"
  sleep 1
  if dump >"$dir/food-result.xml"; then
    bar_top=$(node check.mjs bounds "$dir/food-result.xml" "Fire " | cut -d' ' -f2)
    # The card's lines hold Nums: their spaces are no-break spaces.
    for want in $'For serve at 5:00\u00a0PM' $'On 6:40\u00a0AM, off 3:40\u00a0PM'; do
      if node check.mjs find "$dir/food-result.xml" "$want" "$(status_bar_px)" "${bar_top:-0}" >/dev/null; then
        log "    after a tap on the bar: \"$want\" shows above it"
      else plan_miss "\"$want\" whole above the result bar after a tap on it"; fi
    done
    shot "$dir/food-result.png"
  else plan_miss "the screen after a tap on the result bar"; fi

  launch "dev/plan?seed=empty&add=stlribs" || { result "FAIL  food-details $s: app did not open (ribs)"; return; }
  sleep 1
  if dump >"$dir/food-ribs.xml"; then
    for want in "St. Louis ribs" "Racks" "Method" "Timing"; do has_text "$dir/food-ribs.xml" "$want" || plan_miss "$want (ribs)"; done
    for want in "Standard" "Total hours" "Add to plan"; do has_label "$dir/food-ribs.xml" "$want" || plan_miss "$want (ribs)"; done
    shot "$dir/food-ribs.png"
  else plan_miss "food details for ribs"; fi
  launch "dev/plan?seed=empty&add=breasts" || { result "FAIL  food-details $s: app did not open (chicken)"; return; }
  sleep 1
  if dump >"$dir/food-chicken.xml"; then
    for want in "Chicken breasts" "How many" "Cook on" "Thickness" "Prep"; do has_text "$dir/food-chicken.xml" "$want" || plan_miss "$want (chicken)"; done
    for want in "Griddle" "Add to plan"; do has_label "$dir/food-chicken.xml" "$want" || plan_miss "$want (chicken)"; done
    shot "$dir/food-chicken.png"
  else plan_miss "food details for chicken breasts"; fi
  if [ $ok = 1 ]; then result "PASS  food-details $s"; else result "FAIL  food-details $s"; fi
}

# T-058: the app survives a font-size change, its activity being destroyed and its process being killed.
# Emulator only (it changes developer settings and kills the app).
# 1. Font size changed with the app open on Gear: the same activity (its window, the DecorView in
#    `dumpsys activity <package>`, is the same object; a rebuilt activity has a new one), still on Gear, and the
#    Plan tab's label is drawn at the new size one second later.
# 2. "Don't keep activities" on: food details with an unsaved rate, Home, back to the app: the same screen
#    with the unsaved value.
# 3. A running test cook, on Gear, the process killed in the background: the app's pending alarms are the same
#    before and after, and the app comes back on Gear.
activity_view() { A shell dumpsys activity "$PKG" </dev/null | grep -A400 "ACTIVITY $PKG/.MainActivity" | grep -m1 -oE 'DecorView\{[0-9a-f]+'; }
app_alarms() { A shell dumpsys alarm </dev/null | grep -oE "Alarm\{[^}]*$PKG\}" | sed -E 's/Alarm\{[0-9a-f]+ /Alarm{/; s/ whenElapsed [0-9]+//' | sort -u; }
text_height() { local b; b=$(node check.mjs text "$1" "$2") || return 1; set -- $b; echo $(($4 - $2)); }
# Open the app again the way the launcher would, without stopping it first (launch force-stops, and a
# force-stop also cancels the app's alarms, which is not what Android does when it kills a process).
reopen() {
  A shell am start -W -a android.intent.action.VIEW \
    -d "pitplanner://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$METRO_PORT" "$PKG" >/dev/null
  wait_for_app 90 && wait_for_refresh
}
# Open a route in the running app (no force-stop: that would also cancel the app's alarms).
open_route() {
  A shell am start -W -a android.intent.action.VIEW -d "'pitplanner://$1'" "$PKG" >/dev/null
  sleep 2
}
# The Next up card in a dump: its overline ("CHECK AT 11:35 AM") and the countdown at the end of its title
# ("Check the brisket in 1 hr 12 min"; the title's test id is next-title).
# Numbers hold no-break spaces, so they are matched loosely and printed with plain ones.
next_overline() { grep -oiE 'text="(check.at|at|overdue.since).[0-9][^"]*"' "$1" | head -n 1 | sed -E 's/^text="|"$//g' | tr '\302\240' '  ' | tr -s ' '; }
next_title() { grep -oE 'text="[^"]*" resource-id="next-title"' "$1" | head -n 1 | sed -E 's/^text="|" resource-id.*$//g' | tr '\302\240' '  ' | tr -s ' '; }
next_countdown() { next_title "$1" | grep -oE '(in [0-9].*|now|[0-9][^,]* overdue)$'; }
countdown_min() { local d h m; d=$(grep -oE '[0-9]+ day' <<<"$1" | grep -oE '[0-9]+'); h=$(grep -oE '[0-9]+ hr' <<<"$1" | grep -oE '[0-9]+'); m=$(grep -oE '[0-9]+ min' <<<"$1" | grep -oE '[0-9]+'); echo $((${d:-0} * 1440 + ${h:-0} * 60 + ${m:-0})); }

test_survive() {
  local s="$1" dir="$2" ok=1 other h0 h1 r0 r1 a0 a1 a2 o0 o1 o2 c0 c1 c2
  if ! is_emulator; then result "SKIP  survive $s: emulator only"; return; fi
  [ "$s" = 1.3 ] && other=1.15 || other=1.3

  launch "" || { result "FAIL  survive $s: app did not open"; return; }
  tap "Gear" 1 | tee -a "$REPORT"
  if dump >"$dir/survive-font-before.xml" && h0=$(text_height "$dir/survive-font-before.xml" "Plan"); then
    r0=$(activity_view)
    A shell settings put system font_scale "$other"
    sleep 1
    if dump >"$dir/survive-font-after.xml" && h1=$(text_height "$dir/survive-font-after.xml" "Plan"); then
      r1=$(activity_view)
      grep -q 'content-desc="Gear"[^>]*selected="true"' "$dir/survive-font-after.xml" || plan_miss "Gear still open after the font-size change"
      if [ -n "$r0" ] && [ "$r0" = "$r1" ]; then log "    font size $s -> $other: the same activity (its window is still $r1)"
      else plan_miss "the same activity after the font-size change (its window was \"$r0\", is \"$r1\")"; fi
      if { [ "$other" = 1.3 ] && [ "$h1" -gt "$h0" ]; } || { [ "$other" = 1.15 ] && [ "$h1" -lt "$h0" ]; }; then
        log "    the Plan tab label is drawn at the new size after 1 s ($h0 px -> $h1 px)"
      else plan_miss "text at the new size 1 s after the change (Plan tab label $h0 px -> $h1 px)"; fi
    else plan_miss "the screen after the font-size change"; fi
    A shell settings put system font_scale "$s"
    sleep 1
  else plan_miss "the Gear screen"; fi

  A shell settings put global always_finish_activities 1
  if launch "dev/plan?seed=mockup&edit=b"; then
    scroll_bottom | tee -a "$REPORT"
    on_screen "More hours per pound" UP
    tap "More hours per pound" 1 | tee -a "$REPORT"
    A shell input keyevent KEYCODE_HOME
    sleep 2
    if reopen && sleep 1 && dump >"$dir/survive-activity.xml"; then
      has_text "$dir/survive-activity.xml" "Brisket" && has_label "$dir/survive-activity.xml" "Save" ||
        plan_miss "food details for the brisket after the activity was destroyed"
      scroll_bottom | tee -a "$REPORT"
      dump >"$dir/survive-activity-rate.xml" && grep -qE 'text="0\.80.hr/lb"' "$dir/survive-activity-rate.xml" ||
        plan_miss "the unsaved 0.80 hr/lb after the activity was destroyed"
      [ $ok = 1 ] && log "    Don't keep activities: food details came back with the unsaved 0.80 hr/lb"
      shot "$dir/survive-activity.png"
      tap "Close" 1 | tee -a "$REPORT"
    else
      plan_miss "the app after Home and back (Don't keep activities)"
      dump >"$dir/survive-activity-missing.xml" && log "      on screen: $(grep -oE '(text|content-desc)="[^"]+"' "$dir/survive-activity-missing.xml" | head -12 | tr '\n' ' ')"
      log "      top: $(A shell dumpsys activity activities </dev/null | grep -m1 -E 'topResumedActivity|mResumedActivity' | sed -E 's/ t[0-9]+.*//')"
    fi
  else plan_miss "food details (the app did not open)"; fi
  A shell settings put global always_finish_activities 0

  if launch "dev/alarm?cook=30"; then
    sleep 2
    A shell am start -W -a android.intent.action.VIEW -d "'pitplanner://gear'" "$PKG" >/dev/null
    sleep 2
    a0=$(app_alarms)
    A shell input keyevent KEYCODE_HOME
    sleep 2
    A shell am kill "$PKG"
    sleep 1
    if [ -n "$(A shell pidof "$PKG" | tr -d '\r')" ]; then plan_miss "the process killed (it is still running)"; fi
    a1=$(app_alarms)
    if [ -n "$a0" ] && [ "$a0" = "$a1" ]; then log "    process killed: the app's $(wc -l <<<"$a0") pending alarm(s) are unchanged"
    else plan_miss "the same pending alarms after the kill (before: $(wc -l <<<"$a0"), after: $(wc -l <<<"$a1"))"; fi
    if reopen && dump >"$dir/survive-kill.xml"; then
      if grep -q 'content-desc="Gear"[^>]*selected="true"' "$dir/survive-kill.xml"; then log "    the app came back on Gear"
      else plan_miss "Gear open after the process was killed"; fi
      a2=$(app_alarms)
      if [ "$a1" != "$a2" ]; then
        plan_miss "the same pending alarms after the app started again"
        diff <(echo "$a1") <(echo "$a2") | sed 's/^/      /' | tee -a "$REPORT"
      fi
    else plan_miss "the app after the process was killed"; fi
    # Put things back: end the test cook (clears its alarms) and leave the app on Plan.
    A shell am start -W -a android.intent.action.VIEW -d "'pitplanner://dev/alarm?cook=end'" "$PKG" >/dev/null
    sleep 2
    A shell am start -W -a android.intent.action.VIEW -d "'pitplanner://plan'" "$PKG" >/dev/null
    sleep 2
  else plan_miss "the test cook (the app did not open)"; fi

  # Mid-cook (T-058's leftover, with T-021's Cook screen): on Cook with the mockup cook running, a font-size
  # change and then the process killed in the background: the same Next up and countdown (the countdown may
  # have moved on by the minute that passed).
  if launch "dev/plan?seed=cooking" && dump >"$dir/survive-cook-before.xml"; then
    o0=$(next_overline "$dir/survive-cook-before.xml"); c0=$(next_countdown "$dir/survive-cook-before.xml")
    [[ "$(next_title "$dir/survive-cook-before.xml")" == "Check the brisket "* ]] && [ -n "$o0" ] && [ -n "$c0" ] || plan_miss "Next up on Cook (overline \"$o0\", countdown \"$c0\")"
    r0=$(activity_view)
    A shell settings put system font_scale "$other"
    sleep 1
    if dump >"$dir/survive-cook-font.xml"; then
      o1=$(next_overline "$dir/survive-cook-font.xml"); c1=$(next_countdown "$dir/survive-cook-font.xml")
      r1=$(activity_view)
      [ -n "$r0" ] && [ "$r0" = "$r1" ] || plan_miss "the same activity after the font-size change on Cook"
      grep -q 'content-desc="Cook"[^>]*selected="true"' "$dir/survive-cook-font.xml" || plan_miss "Cook still open after the font-size change"
      if [[ "$(next_title "$dir/survive-cook-font.xml")" == "Check the brisket "* ]] && [ "$o0" = "$o1" ] && [ -n "$c1" ] &&
        [ $(($(countdown_min "$c0") - $(countdown_min "$c1"))) -le 1 ] && [ $(($(countdown_min "$c0") - $(countdown_min "$c1"))) -ge 0 ]; then
        log "    mid-cook font size $s -> $other: Next up is still \"$o1\", \"$c1\" (was \"$c0\")"
      else plan_miss "the same Next up after the font-size change (was \"$o0\", \"$c0\"; is \"$o1\", \"$c1\")"; fi
      shot "$dir/survive-cook-font.png"
    else plan_miss "the Cook screen after the font-size change"; fi
    A shell settings put system font_scale "$s"
    sleep 1
    A shell input keyevent KEYCODE_HOME
    sleep 2
    A shell am kill "$PKG"
    sleep 1
    if [ -n "$(A shell pidof "$PKG" | tr -d '\r')" ]; then plan_miss "the process killed mid-cook (it is still running)"; fi
    if reopen && sleep 1 && dump >"$dir/survive-cook-kill.xml"; then
      o2=$(next_overline "$dir/survive-cook-kill.xml"); c2=$(next_countdown "$dir/survive-cook-kill.xml")
      grep -q 'content-desc="Cook"[^>]*selected="true"' "$dir/survive-cook-kill.xml" || plan_miss "Cook open after the process was killed"
      if [[ "$(next_title "$dir/survive-cook-kill.xml")" == "Check the brisket "* ]] && [ "$o0" = "$o2" ] && [ -n "$c2" ] &&
        [ $(($(countdown_min "$c0") - $(countdown_min "$c2"))) -le 2 ] && [ $(($(countdown_min "$c0") - $(countdown_min "$c2"))) -ge 0 ]; then
        log "    mid-cook process killed: the app came back on Cook with Next up \"$o2\", \"$c2\""
      else plan_miss "the same Next up after the process was killed (was \"$o0\", \"$c0\"; is \"$o2\", \"$c2\")"; fi
    else plan_miss "the app after the process was killed mid-cook"; fi
    open_route "dev/alarm?cook=end"
    open_route "plan"
  else plan_miss "the Cook screen with the mockup cook (the app did not open)"; fi
  if [ $ok = 1 ]; then result "PASS  survive $s"; else result "FAIL  survive $s"; fi
}

# T-021: Start cook and Live cook (mockup 12), with the T-064 rules. Emulator only (it starts and ends cooks).
# 1. No cook: the Cook tab says "No cook running" and starts nothing, with food on the plan; Go to Plan goes
#    to Plan.
# 2. Start cook on a plan for tomorrow: with an alert permission off the check sheet shows first (Start
#    anyway); the Cook tab opens on the first step and the phone holds the cook's alarms.
# 3. With the cook running, Start cook on Plan is greyed out.
# 4. Done moves Next up to the next step.
# 5. The mockup cook (seed=cooking): Next up worded as a check, the countdown, the lane chart's note and the
#    next steps. Screenshots for docs/fidelity.
# The cook is ended at the end (its alarms go with it).
test_cook() {
  local s="$1" dir="$2" ok=1 n want
  if ! is_emulator; then result "SKIP  cook $s: emulator only"; return; fi
  launch "dev/alarm?cook=end" || { result "FAIL  cook $s: app did not open"; return; }
  open_route "dev/plan?seed=tomorrow"
  tap "Cook" 1 | tee -a "$REPORT"
  if dump >"$dir/cook-none.xml"; then
    has_text "$dir/cook-none.xml" "No cook running" || plan_miss "No cook running"
    has_label "$dir/cook-none.xml" "Go to Plan" || plan_miss "Go to Plan"
    n=$(app_alarms | grep -c .)
    if [ "$n" = 0 ]; then log "    no cook: the Cook tab says so and the phone holds no alarms of the app"
    else plan_miss "no alarms with no cook running (the phone holds $n)"; fi
    shot "$dir/cook-none.png"
    tap "Go to Plan" 1 | tee -a "$REPORT"
    dump >"$dir/cook-goplan.xml" && grep -q 'content-desc="Plan"[^>]*selected="true"' "$dir/cook-goplan.xml" || plan_miss "Plan open after Go to Plan"
  else plan_miss "the Cook tab with no cook"; fi

  tap "Start cook" 1 | tee -a "$REPORT"
  sleep 1
  if dump >"$dir/cook-start.xml" && has_text "$dir/cook-start.xml" "Alerts may not ring"; then
    log "    Start cook: an alert permission is off, the check sheet shows ($(grep -oE 'content-desc="Allow [^"]*"' "$dir/cook-start.xml" | sed -E 's/content-desc="Allow |"//g' | paste -sd, -) to allow)"
    shot "$dir/cook-check.png"
    tap "Start anyway" 1 | tee -a "$REPORT"
    sleep 1
  else log "    Start cook: every alert permission is on, no check sheet"; fi
  if dump >"$dir/cook-started.xml"; then
    grep -q 'content-desc="Cook"[^>]*selected="true"' "$dir/cook-started.xml" || plan_miss "the Cook tab open after Start cook"
    has_text "$dir/cook-started.xml" "Cooking" || plan_miss "Cooking"
    [[ "$(next_title "$dir/cook-started.xml")" == "Fire the smoker to 225F in "* ]] || plan_miss "Next up: Fire the smoker to 225F in ... (is \"$(next_title "$dir/cook-started.xml")\")"
    [ -n "$(next_countdown "$dir/cook-started.xml")" ] || plan_miss "the countdown"
    n=$(app_alarms | grep -c .)
    if [ "$n" -gt 0 ]; then log "    cook started: Next up \"$(next_overline "$dir/cook-started.xml")\", $(next_countdown "$dir/cook-started.xml"); the phone holds $n alarm(s) of the app"
    else plan_miss "the cook's alarms on the phone"; fi
    shot "$dir/cook-started.png"
  else plan_miss "the screen after Start cook"; fi

  tap "Plan" 1 | tee -a "$REPORT"
  if dump >"$dir/cook-plan.xml" && grep -q 'content-desc="Start cook"[^>]*enabled="false"' "$dir/cook-plan.xml"; then
    log "    with the cook running, Start cook on Plan is greyed out"
    shot "$dir/cook-plan.png"
  else plan_miss "Start cook greyed out while a cook runs"; fi

  tap "Cook" 1 | tee -a "$REPORT"
  tap "Done" 1 | tee -a "$REPORT"
  sleep 1
  if dump >"$dir/cook-done.xml" && [[ "$(next_title "$dir/cook-done.xml")" == "Brisket on the smoker, unwrapped in "* ]]; then
    log "    Done: Next up moved on to \"Brisket on the smoker, unwrapped\""
  else plan_miss "the next step after Done (Brisket on the smoker, unwrapped)"; fi

  open_route "dev/plan?seed=cooking"
  if dump >"$dir/cook-live.xml"; then
    for want in "Cooking" "On plan" "After that" "Brisket" "Wings" "Breasts"; do
      has_text "$dir/cook-live.xml" "$want" || plan_miss "$want (mockup cook)"
    done
    for want in "Done" "Adjust" "Cook options" "Full timeline"; do
      has_label "$dir/cook-live.xml" "$want" || has_text "$dir/cook-live.xml" "$want" || plan_miss "$want (mockup cook)"
    done
    grep -qiE 'text="check.at.[0-9][^"]*"' "$dir/cook-live.xml" || plan_miss "the overline \"Check at ...\""
    [[ "$(next_title "$dir/cook-live.xml")" =~ ^Check\ the\ brisket\ in\ 1\ hr\ 1[0-2]\ min$ ]] || plan_miss "the title \"Check the brisket in 1 hr 12 min\" (is \"$(next_title "$dir/cook-live.xml")\")"
    grep -qE 'text="Smoker.225F, serve.[0-9:]+.[AP]M"' "$dir/cook-live.xml" || plan_miss "the header line \"Smoker 225F, serve ...\""
    [ $ok = 1 ] && log "    mockup cook: \"$(next_overline "$dir/cook-live.xml")\", \"$(next_title "$dir/cook-live.xml")\""
    shot "$dir/cook-live.png"
    scroll_bottom | tee -a "$REPORT"
    if dump >"$dir/cook-live-end.xml"; then
      grep -qE 'share the smoker at.225F' "$dir/cook-live-end.xml" || plan_miss "the shared smoker note under the chart"
      has_text "$dir/cook-live-end.xml" "Wings on the smoker on a wire rack" || plan_miss "the next step (Wings on the smoker on a wire rack)"
      shot "$dir/cook-live-end.png"
    else plan_miss "the end of the Cook screen"; fi
  else plan_miss "the Cook screen with the mockup cook"; fi

  # Put things back: end the cook (clears its alarms) and leave the app on Plan.
  open_route "dev/alarm?cook=end"
  n=$(app_alarms | grep -c .)
  [ "$n" = 0 ] || plan_miss "no alarms after the cook was ended (the phone holds $n)"
  open_route "plan"
  if [ $ok = 1 ]; then result "PASS  cook $s"; else result "FAIL  cook $s"; fi
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
if [[ " ${TESTS[*]} " == *" plan-sheets "* ]]; then
  sheet_imgs=()
  for s in "${SCALES[@]}"; do
    pct=$(awk -v s="$s" 'BEGIN { printf "%d", s * 100 + 0.5 }')
    sheet_imgs+=("Temp $pct%=$OUT/$s/sheets-temp.png" "Add food $pct%=$OUT/$s/sheets-food.png" "Conflicts $pct%=$OUT/$s/sheets-issues.png")
  done
  python3 -I compose.py "$OUT/plan-sheets.png" "${sheet_imgs[@]}" && IMAGES+=("$OUT/plan-sheets.png")
fi
if [[ " ${TESTS[*]} " == *" food-details "* ]]; then
  for s in "${SCALES[@]}"; do
    pct=$(awk -v s="$s" 'BEGIN { printf "%d", s * 100 + 0.5 }')
    python3 -I compose.py "$OUT/food-details-$pct.png" "Brisket $pct%=$OUT/$s/food-brisket.png" \
      "Result $pct%=$OUT/$s/food-result.png" "Ribs $pct%=$OUT/$s/food-ribs.png" \
      "Chicken $pct%=$OUT/$s/food-chicken.png" && IMAGES+=("$OUT/food-details-$pct.png")
  done
fi
if [[ " ${TESTS[*]} " == *" cook "* ]]; then
  cook_imgs=()
  for s in "${SCALES[@]}"; do
    pct=$(awk -v s="$s" 'BEGIN { printf "%d", s * 100 + 0.5 }')
    [ -f "$OUT/$s/cook-live.png" ] && cook_imgs+=("Live $pct%=$OUT/$s/cook-live.png")
    [ -f "$OUT/$s/cook-live-end.png" ] && cook_imgs+=("End $pct%=$OUT/$s/cook-live-end.png")
    [ -f "$OUT/$s/cook-none.png" ] && cook_imgs+=("No cook $pct%=$OUT/$s/cook-none.png")
  done
  [ ${#cook_imgs[@]} -eq 0 ] || { python3 -I compose.py "$OUT/cook-live.png" "${cook_imgs[@]}" && IMAGES+=("$OUT/cook-live.png"); }
fi
log ""
log "=== device summary ==="
printf '%s\n' "${RESULTS[@]}" | tee -a "$REPORT"
[ ${#IMAGES[@]} -eq 0 ] || log "images: ${IMAGES[*]}"
! printf '%s\n' "${RESULTS[@]}" | grep -q '^FAIL'
