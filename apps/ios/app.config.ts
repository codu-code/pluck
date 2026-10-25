import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExpoConfig } from "expo/config";
import { withXcodeProjectBeta } from "@bacons/apple-targets/build/with-bacons-xcode";
import { type ConfigPlugin, withDangerousMod, withInfoPlist, withXcodeProject } from "expo/config-plugins";

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
  version: "1.2.0",
  // "pluck://" opens screens. The app does not claim "io.getpluck.app", its OAuth redirect (withOnlyPluckScheme below):
  // sign-in comes back over HTTPS from the code the person types (lib/session.ts), so no scheme carries it.
  scheme: "pluck",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "io.getpluck.app",
    // The Apple Developer team (Membership details). The same value as APPLE_TEAM_ID on the web server, which serves
    // apple-app-site-association; prebuild signs both targets with it, so Xcode never needs the team picked by hand.
    ...(process.env.APPLE_TEAM_ID ? { appleTeamId: process.env.APPLE_TEAM_ID } : {}),
    buildNumber: "4", // raise for every TestFlight upload (docs/ios.md)
    supportsTablet: false,
    entitlements: {
      "com.apple.security.application-groups": [GROUP],
      "keychain-access-groups": ["$(AppIdentifierPrefix)io.getpluck.shared"],
    },
    // Links to /shared/…, /lists/… and /items/… open the app (the server's apple-app-site-association, APPLE_TEAM_ID).
    ...(server.startsWith("https://") ? { associatedDomains: [`applinks:${new URL(server).host}`] } : {}),
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
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeProductInteraction", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCrashData", NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      ],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // The languages in packages/i18n (LOCALES). Listing them gives Pluck a Language choice in iOS Settings.
      CFBundleLocalizations: ["en", "es", "pt-BR", "fr", "de", "ja", "it", "nl", "ko", "zh-Hans"],
      // Local servers are plain http.
      ...(server.startsWith("http://") ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true, NSAllowsArbitraryLoads: true } } : {}),
    },
  },
  plugins: [
    "expo-router",
    "expo-localization",
    "expo-secure-store",
    "expo-sqlite",
    "expo-web-browser",
    [
      "expo-font",
      {
        fonts: [
          ...["Regular", "Medium", "SemiBold", "Bold"].map((w) => `./node_modules/geist/dist/fonts/geist-sans/Geist-${w}.ttf`),
          ...["400Regular", "400Regular_Italic", "600SemiBold"].map((w) => `./node_modules/@expo-google-fonts/source-serif-4/${w}/SourceSerif4_${w}.ttf`),
          "./node_modules/@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf", // the wordmark and first-run headlines
        ],
      },
    ],
    // The launch screen: the wordmark on the ground the first screen opens on (scripts/icons.mjs draws both).
    [
      "expo-splash-screen",
      { image: "./assets/splash.png", imageWidth: 123, backgroundColor: "#F6F8F4", dark: { image: "./assets/splash-dark.png", backgroundColor: "#10130F" } },
    ],
    "@bacons/apple-targets",
  ],
  // showServer: "Use your own server" on the sign-in screen. Off in store builds (it distracts everyone who is not
  // self-hosting); on for PLUCK_SHOW_SERVER=1 or a build pointed at another server. A server's own pluck://signin?server=
  // link opens it in any build.
  extra: { server, appGroup: GROUP, showServer: process.env.PLUCK_SHOW_SERVER === "1" || server !== "https://getpluck.io" },
  experiments: { typedRoutes: false },
};

// apple-targets builds a share extension's Release like its Debug. Optimise it, keep a dSYM so crash reports
// symbolicate, and make it iPhone only like the app. Its targets are written in its own pass, so the change goes there.
const withShareRelease: ConfigPlugin = (c) =>
  withXcodeProjectBeta(c, (m) => {
    for (const { props: p } of m.modResults.values() as Iterable<{ props: { isa?: string; name?: string; buildSettings?: Record<string, unknown> } }>) {
      if (p.isa === "XCBuildConfiguration" && p.name === "Release" && p.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER === "io.getpluck.app.share")
        Object.assign(p.buildSettings, { SWIFT_OPTIMIZATION_LEVEL: "-O", DEBUG_INFORMATION_FORMAT: "dwarf-with-dsym", TARGETED_DEVICE_FAMILY: "1" });
    }
    return m;
  });

// Expo also registers the bundle ID as a URL scheme. The app takes no sign-in back through a scheme (lib/session.ts),
// so it claims only pluck://.
const withOnlyPluckScheme: ConfigPlugin = (c) =>
  withInfoPlist(c, (m) => {
    const types = (m.modResults.CFBundleURLTypes ?? []) as { CFBundleURLSchemes?: string[] }[];
    m.modResults.CFBundleURLTypes = types
      .map((t) => ({ ...t, CFBundleURLSchemes: (t.CFBundleURLSchemes ?? []).filter((s) => s !== c.ios?.bundleIdentifier) }))
      .filter((t) => t.CFBundleURLSchemes.length > 0);
    return m;
  });

export default withOnlyPluckScheme(withShareRelease(withDarkIcon(config)));
