#!/bin/bash
# ui.sh dump            -> print clickable elements (text, desc, bounds) on screen
# ui.sh tap "<text>"    -> tap the first element whose text or content-desc matches exactly
A="adb -s 5ece07c1"
$A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
XML=$($A shell cat /sdcard/ui.xml)
if [ "$1" = dump ]; then
  echo "$XML" | grep -oE '(text|content-desc)="[^"]+"[^>]*bounds="[^"]+"' | sed -E 's/ (resource-id|class|package|checkable|checked|clickable|enabled|focusable|focused|scrollable|long-clickable|password|selected|index|NAF)="[^"]*"//g'
  exit
fi
B=$(echo "$XML" | grep -oE "(text|content-desc)=\"$2\"[^>]*bounds=\"\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]\"" | head -1 | grep -oE '\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]')
[ -z "$B" ] && { echo "not found: $2"; exit 1; }
read X1 Y1 X2 Y2 <<<$(echo "$B" | grep -oE '[0-9]+' | tr '\n' ' ')
$A shell input tap $(( (X1+X2)/2 )) $(( (Y1+Y2)/2 )) && echo "tapped $2"
