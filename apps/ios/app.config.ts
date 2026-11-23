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

// What iOS shows when Add first opens the camera, in the app's ten languages (the glossaries in docs/i18n).
const CAMERA = {
  en: "Pluck opens the camera when you take a photo to pluck.",
  es: "Pluck abre la cámara cuando haces una foto para recogerla.",
  "pt-BR": "O Pluck abre a câmera quando você tira uma foto para colher.",
  fr: "Pluck ouvre l’appareil photo quand vous prenez une photo à cueillir.",
  de: "Pluck öffnet die Kamera, wenn du ein Foto zum Pflücken aufnimmst.",
  ja: "Pluckする写真を撮るときにカメラを開きます。",
  it: "Pluck apre la fotocamera quando scatti una foto da prendere.",
  nl: "Pluck opent de camera als je een foto maakt om te plukken.",
  ko: "담을 사진을 찍을 때 Pluck이 카메라를 엽니다.",
  "zh-Hans": "拍照摘下时，Pluck 会打开相机。",
};
// What iOS shows the first time the microphone is tapped (components/Speak.tsx): two questions, one for the
// microphone and one for turning speech into text.
const MIC: Record<string, string> = {
  en: "Pluck listens while you speak a note. It keeps the words and no sound.",
  es: "Pluck escucha mientras dices una nota. Guarda las palabras y ningún sonido.",
  "pt-BR": "O Pluck ouve enquanto você fala uma nota. Ele guarda as palavras e nenhum som.",
  fr: "Pluck écoute pendant que vous dites une note. Il garde les mots et aucun son.",
  de: "Pluck hört zu, während du eine Notiz sprichst. Es behält die Wörter und keinen Ton.",
  ja: "メモを話している間、Pluckが聞き取ります。残るのは言葉だけで、音声は残りません。",
  it: "Pluck ascolta mentre dici una nota. Conserva le parole e nessun suono.",
  nl: "Pluck luistert terwijl je een notitie inspreekt. Het bewaart de woorden en geen geluid.",
  ko: "메모를 말하는 동안 Pluck이 들어요. 말은 글로 남고 소리는 남지 않아요.",
  "zh-Hans": "你说出笔记时，Pluck 会聆听。只保留文字，不保留任何声音。",
};
const SPEECH: Record<string, string> = {
  en: "Pluck turns what you say into text. This device does it when it can. Otherwise Apple does, as it does for the keyboard’s dictation.",
  es: "Pluck convierte lo que dices en texto. Lo hace este dispositivo cuando puede. Si no, lo hace Apple, como con el dictado del teclado.",
  "pt-BR": "O Pluck transforma o que você diz em texto. Este dispositivo faz isso quando pode. Senão, a Apple faz, como no ditado do teclado.",
  fr: "Pluck transforme ce que vous dites en texte. Cet appareil le fait quand il le peut. Sinon, Apple s’en charge, comme pour la dictée du clavier.",
  de: "Pluck wandelt in Text um, was du sagst. Das macht dieses Gerät, wenn es kann. Sonst macht es Apple, wie bei der Diktierfunktion der Tastatur.",
  ja: "話した内容を文字にします。できる場合はこのデバイス上で、できない場合はキーボードの音声入力と同じくAppleが行います。",
  it: "Pluck trasforma in testo quello che dici. Lo fa questo dispositivo quando può. Altrimenti lo fa Apple, come per la dettatura della tastiera.",
  nl: "Pluck zet wat je zegt om in tekst. Dit apparaat doet dat als het kan. Anders doet Apple het, zoals bij het dicteren van het toetsenbord.",
  ko: "말한 내용을 글로 바꿔요. 이 기기가 할 수 있으면 기기에서 하고, 아니면 키보드 받아쓰기처럼 Apple이 해요.",
  "zh-Hans": "Pluck 把你说的话转成文字。此设备能做到时在设备上完成，否则由 Apple 完成，与键盘听写相同。",
};

const config: ExpoConfig = {
  name: "Pluck",
  slug: "pluck",
  version: "1.7.0", // raised once per release, in its own change; never per feature (docs/ios.md)
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
    // Set by scripts/testflight.sh to one more than App Store Connect's highest; never committed. Local builds say 1.
    buildNumber: process.env.PLUCK_BUILD_NUMBER ?? "1",
    // iPad gets the split view at 600 wide and up (app/(tabs)/_layout.tsx); under that, in Split View or Stage Manager, the iPhone layout.
    supportsTablet: true,
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
      // The iPhone stays portrait (`orientation` above); iPad turns every way, which Split View and Stage Manager need.
      "UISupportedInterfaceOrientations~ipad": ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"],
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
          // Italic and BoldItalic are for the words of a Note, which can be either (components/RichText.tsx).
          ...["Regular", "Medium", "SemiBold", "Bold", "Italic", "BoldItalic"].map((w) => `./node_modules/geist/dist/fonts/geist-sans/Geist-${w}.ttf`),
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
    // Add, Photo and Camera (app/add.tsx). The photo library needs no permission: iOS's own picker hands over only
    // what the person picks. The camera asks, in the words below; nothing records sound.
    // The microphone text is given here too: `false` would take the question's words out again, after the speech
    // plugin had put them in, and iOS closes an app that asks for the microphone without them.
    ["expo-image-picker", { cameraPermission: CAMERA.en, photosPermission: false, microphonePermission: MIC.en }],
    ["expo-speech-recognition", { microphonePermission: MIC.en, speechRecognitionPermission: SPEECH.en }],
    "@bacons/apple-targets",
  ],
  // The camera and microphone questions in the other nine languages (iOS reads them from each InfoPlist.strings).
  locales: Object.fromEntries(Object.entries(CAMERA).filter(([l]) => l !== "en").map(([l, text]) => [l, { NSCameraUsageDescription: text, NSMicrophoneUsageDescription: MIC[l], NSSpeechRecognitionUsageDescription: SPEECH[l] }])),
  // showServer: "Use your own server" on the sign-in screen. Off in store builds (it distracts everyone who is not
  // self-hosting); on for PLUCK_SHOW_SERVER=1 or a build pointed at another server. A server's own pluck://signin?server=
  // link opens it in any build.
  extra: { server, appGroup: GROUP, showServer: process.env.PLUCK_SHOW_SERVER === "1" || server !== "https://getpluck.io" },
  experiments: { typedRoutes: false },
};

// apple-targets builds an extension's Release like its Debug. Optimise the share extension and the App Intents
// extension, keep a dSYM so crash reports symbolicate, and build them for iPhone and iPad like the app. Its targets are written in its own pass, so the change goes there.
// Every extension also takes the app's build number and version, in Debug and Release: apple-targets gives an App
// Intents extension build 1 whatever the app's is, and App Store Connect warns when the two differ (ITMS-90473).
const withShareRelease: ConfigPlugin = (c) =>
  withXcodeProjectBeta(c, (m) => {
    for (const { props: p } of m.modResults.values() as Iterable<{ props: { isa?: string; name?: string; buildSettings?: Record<string, unknown> } }>) {
      if (p.isa !== "XCBuildConfiguration" || !p.buildSettings) continue;
      const id = String(p.buildSettings.PRODUCT_BUNDLE_IDENTIFIER);
      if (id.startsWith(`${c.ios?.bundleIdentifier}.`)) Object.assign(p.buildSettings, { CURRENT_PROJECT_VERSION: c.ios?.buildNumber, MARKETING_VERSION: c.version });
      if (p.name === "Release" && ["io.getpluck.app.share", "io.getpluck.app.intents"].includes(id))
        Object.assign(p.buildSettings, { SWIFT_OPTIMIZATION_LEVEL: "-O", DEBUG_INFORMATION_FORMAT: "dwarf-with-dsym", TARGETED_DEVICE_FAMILY: "1,2" });
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
