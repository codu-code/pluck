#!/usr/bin/env bash
# Every extension in a built Pluck.app must carry the app's build number and version: App Store Connect warns when
# one differs (ITMS-90473). scripts/testflight.sh runs this on the archive, before the upload.
# Usage: apps/ios/scripts/check-versions.sh path/to/Pluck.app
set -euo pipefail
app="${1:?the path to Pluck.app}"
read_key() { /usr/libexec/PlistBuddy -c "Print :$1" "$2/Info.plist"; }
bad=0
for key in CFBundleVersion CFBundleShortVersionString; do
  want=$(read_key "$key" "$app")
  echo "$key $want  $(basename "$app")"
  for ext in "$app"/PlugIns/*.appex "$app"/Extensions/*.appex; do
    [ -d "$ext" ] || continue
    got=$(read_key "$key" "$ext")
    echo "$key $got  $(basename "$ext")"
    [ "$got" = "$want" ] || { echo "$(basename "$ext") has $key $got, the app has $want." >&2; bad=1; }
  done
done
exit $bad
