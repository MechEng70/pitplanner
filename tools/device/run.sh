#!/bin/bash
# One unattended device pass on the dev build (TASKS T-006).
#   npm run device -- [--phone] [--no-build] [--repeat N] [--only <test>]...
#   tests: smoke, sheet-keyboard, stable-controls, db, migration-error, db-unopenable (default: all).
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

ALL=(smoke sheet-keyboard stable-controls db migration-error db-unopenable)
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
  if [ -n "$BACKUP" ]; then ./db.sh restore "$BACKUP" | tee -a "$REPORT"; fi
  A shell settings put system font_scale "$ORIG_SCALE" && log "font scale back to $ORIG_SCALE"
  A shell settings put global stay_on_while_plugged_in "$ORIG_STAYON"
  A shell settings put global heads_up_notifications_enabled "$ORIG_HEADSUP" && log "heads-up back to $ORIG_HEADSUP"
  if [ -n "$METRO_PID" ]; then kill -- "-$METRO_PID" 2>/dev/null && log "Metro stopped"; fi
  if [ -n "$EMU_STARTED" ]; then ./avd.sh stop && log "emulator stopped"; fi
}
RESULTS=()
trap restore EXIT
rm -f "$OUT/logcat-failed.txt"
clear_logcat
A shell svc power stayon usb
# Other apps' heads-up banners (chat messages) must not land in screenshots.
A shell settings put global heads_up_notifications_enabled 0

# --- build, Metro, backup ---------------------------------------------------------------------------------
if [ -z "$NOBUILD" ]; then
  log "== build + install the dev build"
  # assembleDebug + adb install to the target only (installDebug would install on every attached device).
  (cd "$ROOT" && tools/prebuild-if-stale.sh &&
    cd android && JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ./gradlew -q assembleDebug &&
    adb -s "$ANDROID_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk) 2>&1 |
    tail -5 | tee -a "$REPORT"
  [ "${PIPESTATUS[0]}" -eq 0 ] || { log "build failed"; exit 1; }
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
    if ! on_screen "$label" || ! dump >"$before"; then broken=1; continue; fi
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

for s in 1.15 1.3; do
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
log ""
log "=== device summary ==="
printf '%s\n' "${RESULTS[@]}" | tee -a "$REPORT"
[ ${#IMAGES[@]} -eq 0 ] || log "images: ${IMAGES[*]}"
! printf '%s\n' "${RESULTS[@]}" | grep -q '^FAIL'
