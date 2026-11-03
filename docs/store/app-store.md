# App Store launch

Everything for the iPhone and iPad listing, the featuring nomination and the launch posts. The English copy lives in `en.json` (the source the nine translations follow) and on the design canvas as the `AppStoreListing` board. Research behind it: the Pluck App Store Research page, 26 October 2026.

## Product page

Paste from `en.json`. Counts against Apple's limits:

| Field | Count | Limit |
|---|---|---|
| name | 17 | 30 characters |
| subtitle | 24 | 30 characters |
| promotionalText | 132 | 170 characters |
| description | 1482 | 4000 characters |
| keywords | 97 | 100 bytes |

Support URL https://getpluck.io/support, marketing URL https://getpluck.io, privacy policy https://getpluck.io/privacy. Category Productivity, then News. Copyright 2026 Codú Limited.

## Screenshots

`screenshots/6.9in` (1320 × 2868) and `screenshots/6.3in` (1206 × 2622), PNG with no alpha, in upload order. Drawn on the canvas as `AppStore1` to `AppStore7`, with an everyday sample library rather than developer reading. Frame 5 is dark mode.

Before launch, swap each drawn phone screen for a real Simulator capture of the same library (`scripts/demo-seed.mjs` with the sample Items in the table below), so the listing shows the app exactly as it ships.

| Kind | Sample Item |
|---|---|
| Read | The surprising science of habits (a longread, 14 min); How to actually rest (a newsletter) |
| Watch | 15-minute chilli oil noodles (TikTok, 0:58); Guitar for grown-ups, lesson one (YouTube, 22 min) |
| PDF | Lisbon in three days.pdf (12 pages) |
| Image | Green kitchen, oak shelves |
| Note | Ask Dad about the boat |
| Todo | Book the dentist, due Friday |
| Thing | Linen duvet cover, king, €89 |
| List | Lisbon, May: six places with a note each |

### iPad

`ipad/with-text` and `ipad/art-only` (2064 × 2752, PNG with no alpha), the `AppStore-iPad-1` to `7` boards. Captions in `ipad/strings.en.json`. Frames 2 to 5 are real captures of the sample library on the 13 in iPad Pro Simulator, in portrait (5 in dark mode). Frames 1, 6 and 7 are still drawn:

- 1 is the share sheet over Safari, which needs driving by hand.
- 6 and 7 are Settings, which against a local server shows `127.0.0.1` and no connected AI tool. Capture them from a TestFlight build signed in to getpluck.io with an AI tool connected.

To make them again:

```sh
cd packages/extract/fixtures/pages && python3 -m http.server 4181 --bind 127.0.0.1 &   # or the fixtures container on 4180
PLUCK_FIXTURES=http://127.0.0.1:4181 node scripts/demo-seed.mjs http://127.0.0.1:3000 <new email> --store
pnpm --filter @pluck/web worker   # reads the picture and the PDF; stop it once both are done
cd apps/ios && EXPO_NO_DOTENV=1 PLUCK_SERVER=http://127.0.0.1:3000 EXPO_PUBLIC_DEMO_KEY=<key> \
  xcodebuild -workspace ios/Pluck.xcworkspace -scheme Pluck -configuration Release -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" -derivedDataPath ios/build-release CODE_SIGN_IDENTITY=- build
xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100
xcrun simctl launch booted io.getpluck.app -demoDetail item:<id>   # then: xcrun simctl io booted screenshot 2.png
node scripts/store-ipad.mjs <dir with 2.png … 7.png>
```

Every other language has its own set in `ipad/<lang>/` (frames 1 to 5), with the app itself in that language: the words in `ipad/strings.<lang>.json`, drawn with each board's own text layer over `art-only`, and the captures made with the Simulator in that language (`xcrun simctl launch booted io.getpluck.app -AppleLanguages "(de)" -AppleLocale de_DE …`):

```sh
node scripts/store-ipad.mjs --lang de <dir with that language's 2.png … 5.png>
```

App Store Connect takes `es` for both es-ES and es-MX. Frames 6 and 7 are not uploaded: they draw Settings that the iPad app does not have yet ("What it changed this week").

`EXPO_NO_DOTENV=1` keeps `.env.local`'s PostHog key out of the build. Each number's launch arguments: 2 `-demoDetail item:<kitchen>`, 3 `-demoDetail item:<habits>`, 4 `-demoRoute /lists -demoDetail list:<Lisbon, May>`, 5 (dark: `xcrun simctl ui booted appearance dark`) `-demoSection archive -demoDetail item:<Pastéis de Belém>`.

No app preview video for launch. A preview must be a screen recording of the app itself (886 × 1920, 15 to 30 s).

## Preview

`pnpm --filter @pluck/web dev`, then `/dev/store`: the listing as the App Store shows it, in every language, iPhone or iPad, light or dark, with the search result, Apple's limits and voice.md's rules checked. "All languages" lays every language's screenshots side by side. It reads this folder, so it shows what is here; keep it in step with App Store Connect. Production answers 404.

Every page opens with what is still to do for that language and device, and marks the screenshots it covers: the known issues in `audit.json` (remove an entry once it is fixed), and what the page checks for itself (a field over Apple's limit, a line voice.md rules out, a set shorter than English's). Red is an App Review risk, orange is polish.

`screenshots/<lang>/` is each other language's iPhone set as uploaded (1206 × 2622); English is `screenshots/6.9in`.

## Featuring art

In `featuring/`, as layered SVG and PNG, for when Apple asks after a nomination: `Featuring-KeyArt.png` is the universal key art at 5244 × 2950 (no logo, no words), and also the 16:9 master Apple takes for a product page header or a search result asset. `Featuring-Header.png` is the 4320 × 1080 header. Supporting imagery (4000 × 4000, three to five screens on their own layers) is made when Apple asks, from the real captures.

The listing text in `<lang>.json` is what is live in App Store Connect; change it there first, then here.

## Featuring nomination

App Store Connect, Pluck, Featuring, Nominations, Create Nomination. Send it at least three weeks before launch. The type and related apps can't change after it is sent.

- **Name:** Pluck for iPhone and iPad, launch (14 January 2027)
- **Type:** App Launch
- **Description:** Pluck is a read-it-later app for everything, not just articles: a recipe from TikTok, a longread, a travel PDF, a lamp to buy, a note to self. You pluck it from the share sheet in one tap and the app never opens. Later, you sort it by hand, or ask the AI tool you already use, because Pluck has no AI inside. It connects to Claude, ChatGPT, Cursor and others over MCP, an open standard, and that AI can never delete anything. Things you leave alone move to the Archive after 30 days. Nothing is deleted. Pluck is free and open source, so it can't vanish the way Pocket and Omnivore did.
- **What is unique:** A fresh take on a familiar category. Read-it-later apps either nag you or quietly delete things. Pluck does neither: untouched items go to an Archive you can search, and the share sheet saves in place without opening the app. There's no AI in the app. People bring their own AI, and every change it makes is marked and can be undone in one tap. The whole app is open source, and anyone can run their own server.
- **Accessibility:** Dynamic Type up to the largest sizes, checked in the Simulator: rows grow and nothing clips. VoiceOver labels on the controls and the kind glyphs. Light and dark mode throughout. Animations respect Reduce Motion.
- **Localization:** English, German, French, Spanish, Italian, Dutch, Portuguese (Brazil), Japanese, Korean and Simplified Chinese at launch.
- **About the team:** Made in Ireland by Codú, a coding community of about 10,000 developers. Built in the open.
- **Supplemental URLs:** [TESTFLIGHT PUBLIC LINK], https://getpluck.io, https://getpluck.io/connect, https://getpluck.io/open-source, https://github.com/codu-code/pluck.

## Promo video and posts

`promo/pluck-promo-1080.mp4`: 20 s, 1080 × 1080, 30 fps, H.264. Upload it natively to LinkedIn and X (both autoplay muted, so the captions carry it). Source: `promo/promo.html`, pure CSS. Re-record with `node scripts/record-promo.mjs`.

**X**

```
Pocket shut down. Omnivore shut down.

So we made Pluck. Tap Share and it's plucked. Sort it later, or ask your AI. Nothing is deleted.

Free and open source. iPhone, Chrome and the web.

getpluck.io
```

**LinkedIn**

```
Every read-it-later app I used either nagged me or shut down.

So we built Pluck. You find something good, a recipe, a longread, a trip, a lamp for the kitchen. You tap Share and it's plucked. The app doesn't even open.

Then you sort it later. Or you don't. Things you leave alone move to the Archive after 30 days. Nothing is deleted.

There's no AI inside Pluck. You bring your own: Claude, ChatGPT, Cursor, whatever you use. One link, and you can ask "plan Lisbon from what I plucked".

It's free and open source, so it can't vanish on you.

iPhone, Chrome and the web: getpluck.io
```

## Still to do

- Re-translate the nine `docs/store/*.json` listings from `en.json`: the screenshots went from five frames to seven, and the description changed.
- Add the TestFlight public link to the nomination.
