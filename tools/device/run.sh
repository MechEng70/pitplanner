#!/bin/bash
# One unattended device pass on the dev build (TASKS T-006). Usage: npm run device -- [--no-build] [--only <test>]...
#   tests: smoke, sheet-keyboard, stable-controls (default: all). --only repeats or takes a comma list.
# Safety (the phone is Jason's own): wakes it and stops if it is locked; backs up the dev build's data and
# restores it on exit; turns heads-up banners off and keeps the screen on while plugged in; runs each test at
# font scale 1.15 and 1.3, relaunching the app after each change; puts every setting back on exit.
# Starts Metro when it is not running (and stops it again). Output: out/report.txt, out/<scale>/*, out/*.png.
# Screenshots are cropped below the status bar.
set -uo pipefail
# shellcheck source=tools/device/lib.sh
. "$(dirname "$0")/lib.sh"
cd "$DEVICE_DIR" || exit 1

ALL=(smoke sheet-keyboard stable-controls)
TESTS=()
NOBUILD=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-build) NOBUILD=1 ;;
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
rm -rf "$OUT/maestro" # last run's Maestro debug output (logs, uncropped failure screenshots)
REPORT="$OUT/report.txt"
: >"$REPORT"
log() { echo "$*" | tee -a "$REPORT"; }

# --- safety: wake, refuse if locked, settings saved and restored on exit --------------------------------
A shell input keyevent KEYCODE_WAKEUP
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
  if [ -n "$BACKUP" ]; then ./db.sh restore "$BACKUP" | tee -a "$REPORT"; fi
  A shell settings put system font_scale "$ORIG_SCALE" && log "font scale back to $ORIG_SCALE"
  A shell settings put global stay_on_while_plugged_in "$ORIG_STAYON"
  A shell settings put global heads_up_notifications_enabled "$ORIG_HEADSUP" && log "heads-up back to $ORIG_HEADSUP"
  if [ -n "$METRO_PID" ]; then kill -- "-$METRO_PID" 2>/dev/null && log "Metro stopped"; fi
}
trap restore EXIT
A shell svc power stayon usb
# Other apps' heads-up banners (chat messages) must not land in screenshots.
A shell settings put global heads_up_notifications_enabled 0

# --- build, Metro, backup ---------------------------------------------------------------------------------
if [ -z "$NOBUILD" ]; then
  log "== build + install the dev build"
  (cd "$ROOT" && tools/prebuild-if-stale.sh &&
    cd android && JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/temurin-21-jdk}" ./gradlew -q installDebug) 2>&1 |
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
BACKUP=$(./db.sh backup) || { log "backup failed"; exit 1; }
log "data backed up to $BACKUP"

SCREEN_H=$(A shell wm size | grep -oE '[0-9]+$')
RESULTS=()
result() { RESULTS+=("$1"); log "$1"; }

# Screenshot of the phone, cropped below the status bar.
shot() {
  A exec-out screencap -p >"$1"
  python3 -I crop.py "$(status_bar_px)" "$1"
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
# The app opens on Plan and each tab opens: tap the tab, check its title is on screen, take a screenshot.
test_smoke() {
  local s="$1" dir="$2" tab ok=1
  launch "" || { result "FAIL  smoke $s: app did not open"; return; }
  for tab in Plan Cook Gear; do
    tap "$tab" 1 | tee -a "$REPORT"
    # The open tab's tab bar button (label "<icon>, Plan") is selected.
    if dump >"$dir/$tab.xml" && grep -q "content-desc=\"[^\"]*, $tab\"[^>]*selected=\"true\"" "$dir/$tab.xml"; then
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
    shot "$dir/sheet-keyboard-$field.png"
  done
  if [ $ok = 1 ]; then result "PASS  sheet-keyboard $s"; else result "FAIL  sheet-keyboard $s"; fi
}

# T-017 PR-3: tapping a control moves neither it nor anything above it. Targets in targets.tsv. Each step
# compares the screen just before and just after its taps.
test_stable_controls() {
  local s="$1" dir="$2" target route expect label times cur="" cur_expect="" moved_any="" broken="" n=0 out line
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
  while IFS=$'\t' read -r target route expect label times <&3; do
    [[ -z "$target" || "$target" == \#* ]] && continue
    if [ "$target" != "$cur" ]; then
      finish_target
      cur="$target" cur_expect="$expect" moved_any="" broken="" n=0
      launch "$route" || { result "FAIL  stable-controls $s $target: app did not open"; cur=""; continue; }
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

for s in 1.15 1.3; do
  A shell settings put system font_scale "$s"
  dir="$OUT/$s"
  mkdir -p "$dir"
  log "== font scale $s"
  for t in "${TESTS[@]}"; do "test_${t//-/_}" "$s" "$dir"; done
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
log ""
log "=== device summary ==="
printf '%s\n' "${RESULTS[@]}" | tee -a "$REPORT"
[ ${#IMAGES[@]} -eq 0 ] || log "images: ${IMAGES[*]}"
! printf '%s\n' "${RESULTS[@]}" | grep -q '^FAIL'
