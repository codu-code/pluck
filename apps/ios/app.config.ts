import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExpoConfig } from "expo/config";
import { type ConfigPlugin, withDangerousMod, withXcodeProject } from "expo/config-plugins";

// PLUCK_SERVER builds point at another server (local dev, e2e screenshots); store builds use getpluck.io.
const server = process.env.PLUCK_SERVER ?? "https://getpluck.io";
const GROUP = "group.io.getpluck.app";

// The Dark home screen icon (Settings, App icon): an alternate icon set beside the primary one in the asset catalog,
// which Xcode lists in Info.plist itself. Both PNGs come from packages/ui's Icon (scripts/icons.mjs at the repo root).
const DARK_ICON = "AppIconDark";
const withDarkIcon: ConfigPlugin = (c) => {
  c = withDangerousMod(c, ["ios", async (m) => {
    const set = join(m.modRequest.platformProjectRoot, m.modRequest.projectName!, "Images.xcassets", `${DARK_ICON}.appiconset`);
    mkdirSync(set, { recursive: true });
    copyFileSync(join(m.modRequest.projectRoot, "assets/icon-dark.png"), join(set, "icon-dark.png"));
    writeFileSync(join(set, "Contents.json"), JSON.stringify({
      images: [{ filename: "icon-dark.png", idiom: "universal", platform: "ios", size: "1024x1024" }], info: { version: 1, author: "expo" },
    }, null, 2));
    return m;
  }]);
  return withXcodeProject(c, (m) => {
    const configs = m.modResults.pbxXCBuildConfigurationSection() as Record<string, { buildSettings?: Record<string, string> }>;
    for (const { buildSettings: b } of Object.values(configs)) {
      if (b?.PRODUCT_BUNDLE_IDENTIFIER?.replace(/"/g, "") !== "io.getpluck.app") continue; // the app, not the share extension
      b.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = DARK_ICON;
      b.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = "YES";
    }
    return m;
  });
};

const config: ExpoConfig = {
  name: "Pluck",
  slug: "pluck",
  version: "0.1.0",
  // "io.getpluck.app:/oauth" is the OAuth redirect (RFC 8252 reverse-domain); "pluck://" opens screens.
  scheme: ["pluck", "io.getpluck.app"],
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "io.getpluck.app",
    buildNumber: "1", // raise for every TestFlight upload (docs/ios.md)
    supportsTablet: false,
    entitlements: {
      "com.apple.security.application-groups": [GROUP],
      "keychain-access-groups": ["$(AppIdentifierPrefix)io.getpluck.shared"],
    },
    // App Store Connect checks this on upload: the required-reason APIs React Native and Expo use, and what Pluck
    // collects (matches Privacy and the App Privacy answers in docs/ios.md). The share extension has its own.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1", "1C8F.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
      ],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeProductInteraction", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCrashData", NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      ],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Local servers are plain http.
      ...(server.startsWith("http://") ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true, NSAllowsArbitraryLoads: true } } : {}),
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    "expo-web-browser",
    [
      "expo-font",
      {
        fonts: [
          ...["Regular", "Medium", "SemiBold", "Bold"].map((w) => `./node_modules/geist/dist/fonts/geist-sans/Geist-${w}.ttf`),
          ...["400Regular", "400Regular_Italic", "600SemiBold"].map((w) => `./node_modules/@expo-google-fonts/source-serif-4/${w}/SourceSerif4_${w}.ttf`),
        ],
      },
    ],
    "@bacons/apple-targets",
  ],
  extra: { server, appGroup: GROUP },
  experiments: { typedRoutes: false },
};

export default withDarkIcon(config);
