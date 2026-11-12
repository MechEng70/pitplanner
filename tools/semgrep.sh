#!/bin/bash
# Semgrep as the gate runs it (check step 5). Paths default to the whole repo; exclusions live in .semgrepignore
# (generated android/, legacy/, reference/, docs/; see SECURITY-EXCEPTIONS SE-002). r/generic.secrets adds rules
# p/secrets lacks (it misses GitHub tokens). tools/gate.test.mjs plants secrets to prove the gate catches them.
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH" # pipx installs semgrep here
command -v semgrep >/dev/null || { echo "semgrep not found (pipx install semgrep)" >&2; exit 2; }
# --no-git-ignore: also scan new files not yet committed. --error: findings fail the run.
exec semgrep scan --metrics=off --quiet --error --severity ERROR --no-git-ignore \
  --config p/typescript --config p/kotlin --config p/secrets --config r/generic.secrets "${@:-.}"
