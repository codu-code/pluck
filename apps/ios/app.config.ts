import type { ExpoConfig } from "expo/config";

// PLUCK_SERVER builds point at another server (local dev, e2e screenshots); store builds use getpluck.io.
const server = process.env.PLUCK_SERVER ?? "https://getpluck.io";
const GROUP = "group.io.getpluck.app";

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
    supportsTablet: false,
    entitlements: {
      "com.apple.security.application-groups": [GROUP],
      "keychain-access-groups": ["$(AppIdentifierPrefix)io.getpluck.shared"],
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

export default config;
