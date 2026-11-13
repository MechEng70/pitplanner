#!/bin/bash
# Upgrade test on the test emulator: the real 0.2.0 APK, data made through its own screens, then a 0.3.0
# build installed over it (TASKS T-012 acceptance; again in T-038). Emulator only: it needs root and the
# DevTools socket a userdebug image opens for every WebView. Never run against the phone.
#   upgrade020.sh setup          install release/pitplanner-0.2.0.apk and, in the app itself: Setup (Pit Boss
#                                820, griddle, oven), brisket at 0.75 hr/lb saved for future and added to the
#                                plan, two cooks started, ended and saved to history
#   upgrade020.sh check <apk>    install the APK over it, start it, and check what the import moved
# Nothing is uninstalled or deleted: `setup` stops when the release app or data kept from an earlier install
# is already there (Jason decides what happens to it).
set -uo pipefail
APK_ARG="${2:+$(realpath "$2")}"
# shellcheck source=tools/device/lib.sh
. "$(dirname "$0")/lib.sh"
cd "$DEVICE_DIR" || exit 1
APP=io.github.mecheng70.pitplanner
DATA=/data/data/$APP
PORT=9333
pick_target || exit 1
is_emulator || { echo "upgrade020 runs on the emulator only" >&2; exit 1; }
A root >/dev/null
A wait-for-device
W() { node webview.mjs $PORT "$@" || { echo "0.2.0 setup stopped at: $*" >&2; exit 1; }; }

setup() {
  if A shell pm path $APP >/dev/null 2>&1; then echo "$APP is already installed on the emulator" >&2; exit 1; fi
  if [ -n "$(A shell "ls $DATA 2>/dev/null")" ]; then
    echo "data kept from an earlier install is in $DATA: move it aside first" >&2
    exit 1
  fi
  A install -d "$ROOT/release/pitplanner-0.2.0.apk" | tail -1
  A shell am start -W -n $APP/.MainActivity >/dev/null
  sleep 5
  A forward tcp:$PORT "localabstract:webview_devtools_remote_$(A shell pidof $APP | tr -d '\r')" >/dev/null
  W wait "Welcome to Pit Planner"
  W click button Continue
  W click checkbox Smoker
  W click option "Pit Boss 820"
  W click checkbox Griddle
  W click button Continue
  W click button "Finish setup"
  W click button "Add food"
  W click button Brisket
  W click button "Less hours per pound" 10
  W click checkbox "Use for future"
  W click button "Add to plan"
  for _ in 1 2; do
    W click button "Start cook"
    W click button "Start anyway"
    W click button Done
    W click button Done
    W click button Apply
    W click button "Cook options"
    W click button "End cook"
    W click button "Save to history"
  done
  A forward --remove tcp:$PORT
  A shell am force-stop $APP
  A shell "ls $DATA/shared_prefs/CapacitorStorage.xml $DATA/files/history.json" || exit 1
  echo "0.2.0 is set up: gear, a saved rate, a plan draft, two past cooks"
}

check() {
  local apk="${1:?check needs an APK}" ok=1 got ui
  want() { # name, SQL, expected
    got=$(A shell "sqlite3 $DATA/files/SQLite/pitplanner.db \"$2\"" | tr -d '\r')
    if [ "$got" = "$3" ]; then echo "  $1: $got"; else ok=0; echo "  WRONG $1: $got (expected $3)"; fi
  }
  A shell "ls $DATA/shared_prefs/CapacitorStorage.xml $DATA/files/history.json" >/dev/null ||
    { echo "no 0.2.0 data on the emulator: run setup first" >&2; exit 1; }
  [ -f "$apk" ] || { echo "no such APK: $apk" >&2; exit 1; }
  A install -r "$apk" | tail -1
  [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "install failed" >&2; exit 1; }
  A shell dumpsys package $APP | grep -m1 versionName
  A shell am start -W -n $APP/.MainActivity >/dev/null
  sleep 15
  ui=$(A exec-out uiautomator dump /dev/tty)
  if grep -q 'content-desc="Plan"' <<<"$ui"; then echo "  the app opened on its tabs"; else ok=0; echo "  WRONG: the app did not open"; fi
  if grep -q "Pit Planner has a new look" <<<"$ui"; then ok=0; echo "  WRONG: a notice showed, none expected"; else echo "  no notice"; fi
  A shell am force-stop $APP
  want "import" "SELECT json_extract(value,'\$.status') FROM kv WHERE key='legacy_import'" done
  want "cookers" "SELECT group_concat(kind) FROM (SELECT kind FROM cookers ORDER BY kind)" "griddle,oven,smoker"
  want "smoker" "SELECT json_extract(profile,'\$.name') FROM cookers WHERE kind='smoker'" "Pit Boss 820"
  want "saved rate" "SELECT food_id || ' ' || hr_per_lb FROM rate_overrides" "brisket 0.75"
  want "plan draft items" "SELECT json_array_length(json_extract(value,'\$.items')) FROM kv WHERE key='draft'" 1
  want "units" "SELECT value FROM kv WHERE key='units'" '{"temp":"F","weight":"lb"}'
  want "past cooks" "SELECT count(*) FROM cook_history" 2
  want "past cook items" "SELECT count(*) FROM cook_history_items" 2
  want "quarantined" "SELECT count(*) FROM kv WHERE key LIKE 'quarantine:%'" 0
  got=$(A shell "ls $DATA/shared_prefs $DATA/files" | tr -d '\r' | tr '\n' ' ')
  for f in CapacitorStorage.imported.xml history.json.imported; do
    if [[ " $got " == *" $f "* ]]; then echo "  kept copy: $f"; else ok=0; echo "  WRONG: no $f"; fi
  done
  if [[ " $got " == *" history.json "* ]]; then ok=0; echo "  WRONG: history.json was not retired"; fi
  if [ $ok = 1 ]; then echo "PASS  upgrade from 0.2.0"; else echo "FAIL  upgrade from 0.2.0"; exit 1; fi
}

case "${1:-}" in
  setup) setup ;;
  check) check "$APK_ARG" ;;
  *) echo "usage: upgrade020.sh setup | check <apk>" >&2; exit 2 ;;
esac
