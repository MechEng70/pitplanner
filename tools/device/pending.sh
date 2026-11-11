#!/bin/bash
# Pit Planner alarms registered with AlarmManager: action and scheduled wall time, one per line.
adb -s 5ece07c1 shell dumpsys alarm | grep -A2 "io.github.mecheng70.pitplanner.debug}" | grep -oE "pitplanner\.(FIRE|NAG) component|origWhen=[0-9-]+ [0-9:]+" | sed -E 's/pitplanner\.//; s/ component//; s/origWhen=//' | paste -d' ' - -
