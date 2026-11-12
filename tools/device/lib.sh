#!/bin/bash
# Shared helpers for the device tools (sourced, not run). Bash only: zsh does not word-split, so keep the adb
# wrapper a function. The phone is ANDROID_SERIAL, or the only device attached.
# shellcheck disable=SC2034  # PKG, OUT and DEVICE_DIR are used by the scripts that source this file.

DEVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DEVICE_DIR/../.." && pwd)"
OUT="${DEVICE_OUT:-$DEVICE_DIR/out}"
PKG=io.github.mecheng70.pitplanner.debug
MAESTRO="${MAESTRO:-$(command -v maestro || echo "$HOME/.maestro/bin/maestro")}"
METRO_PORT=8081

if [ -z "${ANDROID_SERIAL:-}" ]; then
  mapfile -t _devs < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  if [ "${#_devs[@]}" -ne 1 ]; then
    echo "Attach exactly one phone or set ANDROID_SERIAL (found ${#_devs[@]})." >&2
    exit 1
  fi
  export ANDROID_SERIAL="${_devs[0]}"
fi

A() { adb -s "$ANDROID_SERIAL" "$@"; }

# Cold start the dev build on its Metro bundle (a plain deep link on a cold start opens the dev launcher
# instead), then open the route, e.g. `launch dev/kit?sheet=form`. Font-scale changes need a cold start too:
# with the app open they recreate the activity and remount the tree (TASKS T-004 notes).
launch() {
  local route="${1:-}"
  A reverse tcp:$METRO_PORT tcp:$METRO_PORT >/dev/null
  A shell am force-stop "$PKG"
  A shell am start -W -a android.intent.action.VIEW \
    -d "pitplanner://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$METRO_PORT" "$PKG" >/dev/null
  wait_for_app 30
  if [ -n "$route" ]; then
    A shell am start -W -a android.intent.action.VIEW -d "pitplanner://$route" "$PKG" >/dev/null
    sleep 2
  fi
}

# The app's UI tree (uiautomator XML) on stdout: the focused window only. If anything else has focus (the
# notification shade, another app), print nothing, collapse the shade and fail: other apps' content must never
# reach a file or the report.
dump() {
  local xml
  xml="$(A exec-out uiautomator dump /dev/tty </dev/null | sed 's#UI hierchary dumped to: /dev/tty##')"
  if grep -o 'package="[^"]*"' <<<"$xml" | grep -qv "package=\"$PKG\""; then
    A shell cmd statusbar collapse </dev/null
    echo "another window had focus (not the app); closed the shade" >&2
    return 1
  fi
  printf '%s\n' "$xml"
}

# Wait until the app (not the dev launcher) shows its tab bar or a dev screen.
wait_for_app() {
  local secs="$1" t0=$SECONDS ui
  while ((SECONDS - t0 < secs)); do
    ui="$(dump 2>/dev/null)"
    if grep -q "package=\"$PKG\"" <<<"$ui" && ! grep -q 'text="DEVELOPMENT SERVERS"' <<<"$ui"; then
      sleep 2
      return 0
    fi
    sleep 1
  done
  echo "The app did not open within ${secs}s (is Metro running?)." >&2
  return 1
}

# Run a Maestro flow file. Flows are written per step (tap, scroll_to) into out/: Maestro 2.12's
# `repeat: times: ${N}` runs "indefinitely" for N=1 and takeScreenshot ignores the path it is given.
# Maestro reads stdin, so it gets /dev/null (otherwise it swallows the rest of a file a caller's loop reads).
# Maestro's debug and test output include the phone's whole logcat, i.e. every app's log (one held another
# app's access token, 2026-11-12). It goes to a fresh temp dir outside the repo that is deleted when the flow
# ends; only the flow's step lines are kept (in the report).
flow() {
  local tmp rc
  tmp="$(mktemp -d)"
  "$MAESTRO" --device "$ANDROID_SERIAL" test --debug-output "$tmp/debug" --test-output-dir "$tmp/test" \
    --flatten-debug-output "$1" </dev/null 2>&1 |
    grep -E 'COMPLETED|FAILED|WARNED|SKIPPED|Error|error' | sed 's/^/    /'
  rc="${PIPESTATUS[0]}"
  rm -rf -- "$tmp"
  return "$rc"
}

# Tap the control labelled $1 (accessibility label or text), $2 times.
tap() {
  local f="$OUT/.tap.yaml" i
  { printf 'appId: %s\n---\n' "$PKG"
    for ((i = 0; i < $2; i++)); do printf -- '- tapOn:\n    text: "%s"\n    waitToSettleTimeoutMs: 500\n' "$1"; done
    printf -- '- waitForAnimationToEnd\n'; } >"$f"
  flow "$f"
}

# Scroll the screen to its end (more swipes than any screen needs; extra ones do nothing).
scroll_bottom() {
  local f="$OUT/.bottom.yaml"
  printf 'appId: %s\n---\n- scroll\n- scroll\n- scroll\n- scroll\n- scroll\n- waitForAnimationToEnd\n' "$PKG" >"$f"
  flow "$f"
}

# Scroll ($2: UP or DOWN) until the control labelled $1 is fully on screen.
scroll_to() {
  local f="$OUT/.show.yaml"
  printf 'appId: %s\n---\n- scrollUntilVisible:\n    element: "%s"\n    direction: %s\n    speed: 60\n    timeout: 30000\n- waitForAnimationToEnd\n' \
    "$PKG" "$1" "$2" >"$f"
  flow "$f"
}

# Pixels to crop off the top of a screenshot: the status bar (CLAUDE.md: never show other apps' icons).
status_bar_px() {
  A shell dumpsys window </dev/null | grep -m1 'type=statusBars' | sed -E 's/.*frame=\[0,0\]\[[0-9]+,([0-9]+)\].*/\1/'
}

# The open keyboard's top edge in px, or nothing when it is closed.
ime_top() {
  A shell dumpsys window </dev/null | grep -m1 'type=ime' | grep 'visible=true' | sed -E 's/.* frame=\[0,([0-9]+)\].*/\1/'
}
