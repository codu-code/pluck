/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "share",
  name: "PluckShare",
  displayName: "Pluck",
  icon: "../../assets/icon.png",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "UniformTypeIdentifiers"],
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
    "keychain-access-groups": config.ios.entitlements["keychain-access-groups"],
  },
});
