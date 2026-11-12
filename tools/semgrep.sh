#!/bin/bash
# Semgrep as the gate runs it (check step 5; tools/gate.test.mjs also runs it on planted secrets).
# Usage: tools/semgrep.sh [semgrep args] [paths]   (paths default to the whole repo)
#        tools/semgrep.sh --update-rules             (refresh the cached rulesets now)
#
# Rules: p/typescript, p/kotlin, p/secrets, r/generic.secrets (adds rules p/secrets lacks; it misses GitHub
# tokens). They are cached as YAML outside the repo (Semgrep's rules license; the repo is public) and the scan
# reads only the cache, so it works offline. Fetching from the registry on every run took up to 97 s and then
# failed when semgrep.dev was unreachable (T-004 prep, 2026-11-12). The cache refreshes when older than 7 days,
# best effort: offline, the old copy is used with a warning. With no cache and no network the scan fails.
#
# Exclusions live in .semgrepignore (generated android/, legacy/, reference/, docs/; SECURITY-EXCEPTIONS SE-002).
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH" # pipx installs semgrep here
export SEMGREP_ENABLE_VERSION_CHECK=0
command -v semgrep >/dev/null || { echo "semgrep not found (pipx install semgrep)" >&2; exit 2; }

RULESETS=(p/typescript p/kotlin p/secrets r/generic.secrets)
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/pitplanner/semgrep-rules"
MAX_AGE_DAYS=7
mkdir -p "$CACHE"

fetch() { # ruleset file -> 0 when a valid rules file was written
  local tmp="$2.tmp.$$"
  if curl -fsS --retry 3 --retry-delay 2 --max-time 30 -o "$tmp" "https://semgrep.dev/c/$1" && head -1 "$tmp" | grep -q '^rules:'; then
    mv "$tmp" "$2"
  else
    rm -f "$tmp"
    return 1
  fi
}

force=0
if [ "${1:-}" = "--update-rules" ]; then force=1; shift; fi

configs=()
for r in "${RULESETS[@]}"; do
  f="$CACHE/$(echo "$r" | tr '/' '_').yml"
  if [ ! -s "$f" ]; then
    fetch "$r" "$f" || { echo "semgrep: no cached $r and the registry is unreachable" >&2; exit 2; }
  elif [ $force = 1 ] || [ -n "$(find "$f" -mtime +$MAX_AGE_DAYS -print)" ]; then
    fetch "$r" "$f" || { [ $force = 1 ] && exit 2; echo "semgrep: could not refresh $r; using the cached copy from $(date -r "$f" +%F)" >&2; }
  fi
  configs+=(--config "$f")
done
[ $force = 1 ] && [ $# -eq 0 ] && { echo "semgrep rules refreshed in $CACHE"; exit 0; }

# --no-git-ignore: also scan new files not yet committed. --error: findings fail the run.
exec semgrep scan --metrics=off --quiet --error --severity ERROR --no-git-ignore "${configs[@]}" "${@:-.}"
