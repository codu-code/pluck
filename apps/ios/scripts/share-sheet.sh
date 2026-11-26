#!/usr/bin/env bash
# Photographs the share sheet plucking a page from Safari, in the Simulator, with nothing tapped on the Mac: the only
# way to see the share extension as iOS shows it (docs/ios.md, "The share sheet in the Simulator").
# Usage: apps/ios/scripts/share-sheet.sh <udid> <Pluck.app, a signed-in demo build> <out dir> [light|dark] [page url]
# Writes <out dir>/0-share-sheet.png, then 01-….png to 26-….png, about one every third of a second.
set -euo pipefail
udid=$1; app=$2; out=$(mkdir -p "$3" && cd "$3" && pwd); look=${4:-light}; page=${5:-http://127.0.0.1:4180/store/field-notes.html}
here=$(cd "$(dirname "$0")/share-sheet" && pwd)
pods=$(dirname "$(dirname "$(sed -n 's/.*exec "\([^"]*\)".*/\1/p' "$(command -v pod)")")")   # CocoaPods' own gems
GEM_HOME=$pods "$(brew --prefix ruby)/bin/ruby" "$here/project.rb"

xcrun simctl bootstatus "$udid" -b >/dev/null
xcrun simctl install "$udid" "$app"
xcrun simctl launch "$udid" io.getpluck.app >/dev/null; sleep 12   # a demo build signs in on its first launch
xcrun simctl terminate "$udid" io.getpluck.app >/dev/null
xcrun simctl ui "$udid" appearance "$look"
xcrun simctl terminate "$udid" com.apple.mobilesafari >/dev/null 2>&1 || true
xcrun simctl openurl "$udid" "$page"; sleep 5
# xcodebuild hands the test runner every variable that starts with TEST_RUNNER_, without the prefix.
TEST_RUNNER_SHOTS=$out xcodebuild test -project "$here/ShareSheet.xcodeproj" -scheme ShareSheetTests \
  -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$here/build" 2>&1 | grep -E "error:|XCTAssert|Test Case .*(passed|failed)"
echo "Pictures in $out"
