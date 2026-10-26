#!/usr/bin/env bash
# Builds the iPhone app for the App Store and uploads it to App Store Connect, where it shows under TestFlight
# once processed. Signing and the upload use an App Store Connect API key, so Xcode needs no account sign-in.
#
# Needs: APPLE_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file) and ASC_APP_ID. docs/ios.md, TestFlight.
# The version is `version` in app.config.ts, chosen at the start (scripts/release.mjs). The build number is not in the repo: it is
# one more than App Store Connect's highest, asked for here, so every upload has a new one.
# Usage: apps/ios/scripts/testflight.sh
set -euo pipefail
: "${APPLE_TEAM_ID:?set APPLE_TEAM_ID}" "${ASC_KEY_ID:?set ASC_KEY_ID}" "${ASC_ISSUER_ID:?set ASC_ISSUER_ID}" "${ASC_KEY_PATH:?set ASC_KEY_PATH}" "${ASC_APP_ID:?set ASC_APP_ID}"
[ -r "$ASC_KEY_PATH" ] || { echo "Can't read the key at $ASC_KEY_PATH" >&2; exit 1; }
cd "$(dirname "$0")/.."
unset PLUCK_SERVER PLUCK_SHOW_SERVER # store builds point at getpluck.io, with no server picker

out="${TMPDIR:-/tmp}/pluck-testflight"
rm -rf "$out" && mkdir -p "$out"
auth=(-allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")

# Which version this is: Keep, Patch (fixes), Minor (features) or Major, written into app.config.ts. Asked only at a
# terminal; anywhere else the version in app.config.ts goes as it is.
if [ -t 0 ]; then node scripts/release.mjs; fi
PLUCK_BUILD_NUMBER=$(node scripts/next-build.mjs)
export PLUCK_BUILD_NUMBER
echo "Building build $PLUCK_BUILD_NUMBER"
pnpm exec expo prebuild -p ios --clean
xcodebuild -workspace ios/Pluck.xcworkspace -scheme Pluck -configuration Release -destination "generic/platform=iOS" \
  -archivePath "$out/Pluck.xcarchive" archive "${auth[@]}"

cat > "$out/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST
xcodebuild -exportArchive -archivePath "$out/Pluck.xcarchive" -exportOptionsPlist "$out/ExportOptions.plist" -exportPath "$out/export" "${auth[@]}"

version=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleShortVersionString" "$out/Pluck.xcarchive/Info.plist")
build=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" "$out/Pluck.xcarchive/Info.plist")
echo "Uploaded $version ($build). It shows in App Store Connect under TestFlight once processed, in about 15 minutes."
