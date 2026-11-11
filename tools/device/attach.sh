#!/bin/bash
# Relaunch Pit Planner and forward its WebView DevTools socket to localhost:9333.
set -e
A="adb -s 5ece07c1"
$A shell am force-stop io.github.mecheng70.pitplanner.debug
$A shell am start -W -n io.github.mecheng70.pitplanner.debug/io.github.mecheng70.pitplanner.MainActivity >/dev/null
PID=$($A shell pidof io.github.mecheng70.pitplanner.debug)
$A forward --remove-all
$A forward tcp:9333 localabstract:webview_devtools_remote_$PID >/dev/null
