#!/usr/bin/env bash
# Dashboard timer (docs/PLAYBOOK.md section 9): a transient systemd user timer that runs scripts/dashboard.py every
# 15 minutes while a round is running. Transient units leave nothing installed and are gone after logout or
# reboot. dashboard.py stops the timer itself if the repo has had no commit for 12 hours.
#   scripts/dashboard-timer.sh start | stop | status
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT=pitplanner-dashboard

case "${1:-status}" in
start)
    if systemctl --user is-active --quiet "$UNIT.timer"; then
        echo "$UNIT.timer already running"
    else
        systemctl --user reset-failed "$UNIT.service" "$UNIT.timer" 2>/dev/null || true
        systemd-run --user --unit="$UNIT" --description="Pit Planner dashboard refresh" \
            --on-active=1min --on-unit-active=15min --timer-property=AccuracySec=30s \
            /usr/bin/python3 "$REPO/scripts/dashboard.py" --timer
    fi
    systemctl --user list-timers "$UNIT.timer" --no-pager
    ;;
stop)
    systemctl --user stop "$UNIT.timer" 2>/dev/null || true
    systemctl --user reset-failed "$UNIT.service" "$UNIT.timer" 2>/dev/null || true
    if systemctl --user is-active --quiet "$UNIT.timer"; then
        echo "$UNIT.timer still running" >&2
        exit 1
    fi
    echo "$UNIT.timer stopped"
    ;;
status)
    if systemctl --user is-active --quiet "$UNIT.timer"; then
        echo "$UNIT.timer running"
        systemctl --user list-timers "$UNIT.timer" --no-pager
    else
        echo "$UNIT.timer not running"
    fi
    ;;
*)
    echo "usage: $0 start | stop | status" >&2
    exit 2
    ;;
esac
