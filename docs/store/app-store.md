# App Store launch

Everything for the iPhone listing, the featuring nomination and the launch posts. The English copy lives in `en.json` (the source the nine translations follow) and on the design canvas as the `AppStoreListing` board. Research behind it: the Pluck App Store Research page, 26 October 2026.

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

No app preview video for launch. A preview must be a screen recording of the app itself (886 × 1920, 15 to 30 s).

## Featuring nomination

App Store Connect, Pluck, Featuring, Nominations, Create Nomination. Send it at least three weeks before launch. The type and related apps can't change after it is sent.

- **Name:** Pluck for iPhone, launch
- **Type:** App Launch
- **Description:** Pluck is a read-it-later app for everything, not just articles: a recipe from TikTok, a longread, a travel PDF, a lamp to buy, a note to self. You pluck it from the share sheet in one tap and the app never opens. Later, you sort it by hand, or ask the AI tool you already use, because Pluck has no AI inside. It connects to Claude, ChatGPT, Cursor and others over MCP, an open standard, and that AI can never delete anything. Things you leave alone move to the Archive after 30 days. Nothing is deleted. Pluck is free and open source, so it can't vanish the way Pocket and Omnivore did.
- **What is unique:** A fresh take on a familiar category. Read-it-later apps either nag you or quietly delete things. Pluck does neither: untouched items go to an Archive you can search, and the share sheet saves in place without opening the app. There's no AI in the app. People bring their own AI, and every change it makes is marked and can be undone in one tap. The whole app is open source, and anyone can run their own server.
- **Accessibility:** Dynamic Type up to the largest sizes, checked in the Simulator: rows grow and nothing clips. VoiceOver labels on the controls and the kind glyphs. Light and dark mode throughout. Animations respect Reduce Motion.
- **Localization:** English, German, French, Spanish, Italian, Dutch, Portuguese (Brazil), Japanese, Korean and Simplified Chinese at launch.
- **About the team:** Made in Ireland by Codú, a coding community of about 10,000 developers. Built in the open.
- **Supplemental URLs:** [TESTFLIGHT PUBLIC LINK], https://getpluck.io, https://getpluck.io/connect, https://getpluck.io/open-source, https://github.com/codu-code/pluck. The repository link works once the repo is public.

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
- Make the repo public before the Support URL and the repository link are used anywhere.
