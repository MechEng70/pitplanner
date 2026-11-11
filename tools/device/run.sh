#!/bin/bash
# One unattended device pass. Usage: tools/device/run.sh [--no-build]
# --only <script>: run just that capture (e.g. --only gear) at both scales.
# Backs up the phone's app data, builds + installs, captures Plan and Brisket at 115% and 130% with
# layout measurements, then restores the data and font size. Writes out/report.txt and out/*.png.
set -e
D="$(cd "$(dirname "$0")" && pwd)"
OUT="$D/out"; mkdir -p "$OUT"
A="adb -s 5ece07c1"
cd "$D"
REPORT="$OUT/report.txt"; : > "$REPORT"
log() { echo "$*" | tee -a "$REPORT"; }

ORIG_SCALE=$($A shell settings get system font_scale | tr -d '\r')
# The WebView only draws with the screen on and unlocked: wake it, keep it on while plugged in, and
# stop early if the lock screen is up (a secure lock can't be dismissed over adb).
$A shell input keyevent KEYCODE_WAKEUP
if $A shell dumpsys window | grep -q "isKeyguardShowing=true"; then
  echo "Phone is locked. Unlock it, then run again."; exit 1
fi
ORIG_STAYON=$($A shell settings get global stay_on_while_plugged_in | tr -d '\r')
$A shell svc power stayon usb
restore() {
  ./attach.sh && node restore.mjs >/dev/null && log "data restored"
  $A shell settings put system font_scale "$ORIG_SCALE"; log "font scale back to $ORIG_SCALE"
  $A shell settings put global stay_on_while_plugged_in "$ORIG_STAYON"
}
trap restore EXIT

ONLY=""; NOBUILD=""
while [ $# -gt 0 ]; do case "$1" in --no-build) NOBUILD=1;; --only) ONLY="$2"; shift;; esac; shift; done
[ -n "$NOBUILD" ] || { log "== build + install"; ./deploy.sh | tee -a "$REPORT"; }
./attach.sh && node backup.mjs >/dev/null && log "data backed up"

for s in 1.15 1.3; do
  $A shell settings put system font_scale $s
  ./attach.sh
  log "== font scale $s"
  if [ -n "$ONLY" ]; then node "$ONLY.mjs" "$OUT/$s" 2>&1 | tee -a "$REPORT"; ./attach.sh && node restore.mjs >/dev/null; continue; fi
  node capture.mjs "$OUT/$s" 2>&1 | tee -a "$REPORT"
  ./attach.sh && node cook.mjs "$OUT/$s" 2>&1 | tee -a "$REPORT"
  ./attach.sh && node setup.mjs "$OUT/$s" 2>&1 | tee -a "$REPORT"
  ./attach.sh && node gear.mjs "$OUT/$s" 2>&1 | tee -a "$REPORT"
  ./attach.sh && node restore.mjs >/dev/null
done

python3 -I compose.py "$OUT/gear.png" "115%=$OUT/1.15/gear.png" "130%=$OUT/1.3/gear.png" "130% end=$OUT/1.3/gear-end.png" "alerts=$OUT/1.15/gear-alerts.png" || true
[ -n "$ONLY" ] && { log "images: $OUT/$ONLY.png"; exit 0; }
python3 -I compose.py "$OUT/plan.png" "115%=$OUT/1.15/plan.png" "130%=$OUT/1.3/plan.png"
python3 -I compose.py "$OUT/brisket.png" "115%=$OUT/1.15/brisket-after-plus.png" "130%=$OUT/1.3/brisket-after-plus.png"
python3 -I compose.py "$OUT/cook.png" "115%=$OUT/1.15/cook.png" "130%=$OUT/1.3/cook.png" "ask=$OUT/1.15/cook-ask.png" "after=$OUT/1.15/cook-after.png" || true
python3 -I compose.py "$OUT/finish.png" "options 115%=$OUT/1.15/options.png" "130%=$OUT/1.3/options.png" "finished 115%=$OUT/1.15/finish.png" "130%=$OUT/1.3/finish.png" || true
python3 -I compose.py "$OUT/setup.png" "1 115%=$OUT/1.15/setup1.png" "2 115%=$OUT/1.15/setup2.png" "2 130%=$OUT/1.3/setup2.png" "picker=$OUT/1.15/setup-picker.png" || true
python3 -I compose.py "$OUT/setup-b.png" "add=$OUT/1.15/setup-add.png" "form 130%=$OUT/1.3/setup-form.png" "3 115%=$OUT/1.15/setup3.png" "3 130%=$OUT/1.3/setup3.png" || true
log "== alarms registered"; ./pending.sh | tee -a "$REPORT"
log "images: $OUT/plan.png $OUT/brisket.png $OUT/cook.png $OUT/finish.png $OUT/setup.png $OUT/setup-b.png"
