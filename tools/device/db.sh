#!/bin/bash
# Back up and restore the dev build's app data (SQLite, prefs, files) over `run-as` (debuggable builds only).
#   db.sh backup [file]    write a tar of the data dirs (default out/data-<time>.tar), print its path
#   db.sh restore <file>   replace the data dirs with the tar's; refuses a tar that is empty or unreadable
# The release app (no .debug) is never touched: run-as only works on debuggable packages.
set -euo pipefail
# shellcheck source=tools/device/lib.sh
. "$(dirname "$0")/lib.sh"
pick_target || exit 1

DIRS=(databases files shared_prefs no_backup)
DATA="/data/data/$PKG"

existing() {
  local d have=()
  for d in "${DIRS[@]}"; do
    if A shell run-as "$PKG" test -d "$DATA/$d"; then have+=("$d"); fi
  done
  echo "${have[@]}"
}

case "${1:-}" in
  backup)
    mkdir -p "$OUT"
    file="${2:-$OUT/data-$(date +%Y%m%d-%H%M%S).tar}"
    read -r -a have <<<"$(existing)"
    [ "${#have[@]}" -gt 0 ] || { echo "No app data to back up." >&2; exit 1; }
    A shell am force-stop "$PKG"
    A exec-out run-as "$PKG" tar -cf - -C "$DATA" "${have[@]}" >"$file"
    tar -tf "$file" >/dev/null || { echo "Backup $file is not a readable tar." >&2; exit 1; }
    echo "$file"
    ;;
  restore)
    file="${2:?usage: db.sh restore <file>}"
    if ! [ -s "$file" ] || ! tar -tf "$file" >/dev/null 2>&1; then
      echo "Not restoring: $file is empty or unreadable." >&2
      exit 1
    fi
    read -r -a top <<<"$(tar -tf "$file" | cut -d/ -f1 | sort -u | tr '\n' ' ')"
    for d in "${top[@]}"; do
      [[ " ${DIRS[*]} " == *" $d "* ]] || { echo "Not restoring: unexpected entry '$d' in $file." >&2; exit 1; }
    done
    A shell am force-stop "$PKG"
    # Remove only the dirs the backup holds, then unpack it over the clean dirs.
    A shell run-as "$PKG" sh -c "cd $DATA && rm -rf ${top[*]}"
    A exec-in run-as "$PKG" tar -xf - -C "$DATA" <"$file"
    echo "restored ${top[*]} from $file"
    ;;
  *)
    echo "usage: db.sh backup [file] | restore <file>" >&2
    exit 2
    ;;
esac
