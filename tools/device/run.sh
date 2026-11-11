#!/bin/bash
# One unattended device pass. Usage: tools/device/run.sh [--no-build]
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
restore() {
  ./attach.sh && node restore.mjs >/dev/null && log "data restored"
  $A shell settings put system font_scale "$ORIG_SCALE"; log "font scale back to $ORIG_SCALE"
}
trap restore EXIT

[ "$1" = "--no-build" ] || { log "== build + install"; ./deploy.sh | tee -a "$REPORT"; }
./attach.sh && node backup.mjs >/dev/null && log "data backed up"

for s in 1.15 1.3; do
  $A shell settings put system font_scale $s
  ./attach.sh
  log "== font scale $s"
  node capture.mjs "$OUT/$s" 2>&1 | tee -a "$REPORT"
  ./attach.sh && node cook.mjs "$OUT/$s" 2>&1 | tee -a "$REPORT"
done

python3 -I compose.py "$OUT/plan.png" "115%=$OUT/1.15/plan.png" "130%=$OUT/1.3/plan.png"
python3 -I compose.py "$OUT/brisket.png" "115%=$OUT/1.15/brisket-after-plus.png" "130%=$OUT/1.3/brisket-after-plus.png"
python3 -I compose.py "$OUT/cook.png" "115%=$OUT/1.15/cook.png" "130%=$OUT/1.3/cook.png" "ask=$OUT/1.15/cook-ask.png" "after=$OUT/1.15/cook-after.png" || true
python3 -I compose.py "$OUT/finish.png" "options 115%=$OUT/1.15/options.png" "130%=$OUT/1.3/options.png" "finished 115%=$OUT/1.15/finish.png" "130%=$OUT/1.3/finish.png" || true
log "== alarms registered"; ./pending.sh | tee -a "$REPORT"
log "images: $OUT/plan.png $OUT/brisket.png $OUT/cook.png $OUT/finish.png"
