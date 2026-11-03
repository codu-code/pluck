/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
// Siri, Spotlight, Shortcuts and the Action button: "Pluck a link" and "Pluck a note", without opening the app.
// It plucks through the share sheet's client (PluckClient.swift, linked from targets/share), so it shares its session
// in the Keychain and its offline queue in the App Group.
module.exports = (config) => ({
  type: "app-intent",
  name: "PluckIntents",
  bundleIdentifier: ".intents", // io.getpluck.app.intents, beside io.getpluck.app.share
  displayName: "Pluck",
  deploymentTarget: "17.0",
  frameworks: ["AppIntents"],
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
    "keychain-access-groups": config.ios.entitlements["keychain-access-groups"],
  },
});
