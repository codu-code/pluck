#!/usr/bin/env bash
# Captures App Store frames 2 to 5 from the Simulator, in each of the ten languages, with launch arguments only (no
# taps, and the Simulator is never brought forward): the Inbox, the reader, a List, and the Archive in dark mode.
# Usage: scripts/store-capture.sh <iphone|ipad> <udid> <Pluck.app, a demo build> <out dir> <seed json>
# The seed json is what `node scripts/demo-seed.mjs <server> <email> --store` prints; the app is a Release Simulator
# build made with that key (docs/store/app-store.md). Writes <out dir>/<lang>/2.png … 5.png, for store-iphone.mjs and
# store-ipad.mjs. It resets the Simulator's keychain, so the build signs in to this library and no earlier one.
set -uo pipefail
device=$1; udid=$2; app=$3; out=$4; seed=$5
id() { python3 -c "import json,sys;print(json.load(open('$seed'))['$1'])"; }
habits=$(id itemId); list=$(id listId); kitchen=$(id kitchenId); pasteis=$(id pasteisId)
bundle=io.getpluck.app
langs=("en en_IE" "es es_ES" "pt-BR pt_BR" "fr fr_FR" "de de_DE" "ja ja_JP" "it it_IT" "nl nl_NL" "ko ko_KR" "zh-Hans zh_CN")

xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1
xcrun simctl terminate "$udid" $bundle >/dev/null 2>&1
xcrun simctl uninstall "$udid" $bundle >/dev/null 2>&1
xcrun simctl keychain "$udid" reset >/dev/null 2>&1   # a session from another demo library would be kept otherwise
xcrun simctl install "$udid" "$app"
xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4
xcrun simctl ui "$udid" appearance light
xcrun simctl launch "$udid" $bundle >/dev/null   # the first launch signs in and fills its cache
sleep 20
xcrun simctl terminate "$udid" $bundle >/dev/null 2>&1

shot() { # <lang> <locale> <n> <args…>
  local lang=$1 locale=$2 n=$3; shift 3
  xcrun simctl terminate "$udid" $bundle >/dev/null 2>&1
  xcrun simctl launch "$udid" $bundle -AppleLanguages "($lang)" -AppleLocale "$locale" "$@" >/dev/null
  sleep 9
  mkdir -p "$out/$lang"
  xcrun simctl io "$udid" screenshot "$out/$lang/$n.png" >/dev/null 2>&1
}

for pair in "${langs[@]}"; do
  set -- $pair; lang=$1; locale=$2
  if [ "$device" = iphone ]; then
    shot "$lang" "$locale" 2
    shot "$lang" "$locale" 3 -demoRoute "/items/$habits"
    shot "$lang" "$locale" 4 -demoRoute "/lists/$list"
    xcrun simctl ui "$udid" appearance dark
    shot "$lang" "$locale" 5 -demoRoute /archive
  else
    shot "$lang" "$locale" 2 -demoDetail "item:$kitchen"
    shot "$lang" "$locale" 3 -demoDetail "item:$habits"
    shot "$lang" "$locale" 4 -demoRoute /lists -demoDetail "list:$list"
    xcrun simctl ui "$udid" appearance dark
    shot "$lang" "$locale" 5 -demoSection archive -demoDetail "item:$pasteis"
  fi
  xcrun simctl ui "$udid" appearance light
  echo "$device $lang done"
done
xcrun simctl terminate "$udid" $bundle >/dev/null 2>&1
