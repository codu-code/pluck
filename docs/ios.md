# Pluck for iPhone

`apps/ios`: an Expo (SDK 58) app with Expo Router, and a hand-written SwiftUI share extension (`apps/ios/targets/share`) added at prebuild by `@bacons/apple-targets`. The share extension is the front door: it plucks in place and the app never opens.

## Run it locally

```sh
pnpm stack                                   # Mongo, Mailpit, MinIO, the fixture pages
pnpm --filter @pluck/web build && pnpm --filter @pluck/web exec next start -p 3000
cd apps/ios
PLUCK_SERVER=http://127.0.0.1:3000 pnpm exec expo prebuild -p ios --clean
PLUCK_SERVER=http://127.0.0.1:3000 pnpm exec expo run:ios   # a Debug build with Metro, or open ios/Pluck.xcworkspace in Xcode
```

`PLUCK_SERVER` sets the default server and, for `http://` servers, allows plain HTTP to the local network. Store builds leave it unset (getpluck.io).

### A demo library and screenshots

`node scripts/demo-seed.mjs` signs a demo person in through the real email link, fills their library (links, a note, a todo, things, tags, two lists) and prints an API key. A Release build made with `EXPO_PUBLIC_DEMO_KEY=<that key>` signs itself in on first launch and takes a screen to open as a launch argument:

```sh
xcodebuild -workspace ios/Pluck.xcworkspace -scheme Pluck -configuration Release -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=iPhone 17" -derivedDataPath ios/build CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO build
xcrun simctl install booted ios/build/Build/Products/Release-iphonesimulator/Pluck.app
xcrun simctl launch booted io.getpluck.app -demoRoute /lists/<id>
xcrun simctl io booted screenshot list.png
```

Never set `EXPO_PUBLIC_DEMO_KEY` for a build that leaves your machine.

## How it fits together

- **Sign in:** OAuth 2.1 with PKCE in a web authentication session, for the API resource (`<server>/api/v1`). The app registers itself once per server (dynamic registration, redirect `io.getpluck.app:/oauth`). The email link may open in Mail or Safari instead of the session; the redirect then reaches the app as a link (`app/oauth.tsx`) and finishes there. "Use your own server" takes a server address and, optionally, a personal API key.
- **Session:** one Keychain item (`expo-secure-store`, service `pluck`) in the app's default access group, which is the shared group `$(AppIdentifierPrefix)io.getpluck.shared`, so the share extension reads the same session and refreshes it the same way.
- **App Group** `group.io.getpluck.app`: the app writes the tags and the last list the share sheet shows; the share extension writes what it could not send (`pending/*.json` and copied files) and the app sends them when it next comes to the foreground.
- **Offline:** the TanStack Query cache is persisted (SQLite key-value), so the app opens on what it last saw; plucks made with no connection queue on the phone.
- **Files** (images, PDFs) from the share sheet: `POST /api/v1/items/files` makes the item and returns a signed upload URL; a background `URLSession` uploads the bytes after the sheet closes, and the worker reads them once they arrive.
- **Pure modules** (`lib/api.ts`, `lib/queue.ts`, `lib/pkce.ts`, `lib/markdown.ts`) have no Expo imports and are tested by the root `pnpm test` (`apps/ios/lib/core.test.ts`).

## Checked automatically

- Typecheck and lint with the rest of the repo; the pure modules' tests in `pnpm test`.
- A Release build for the iOS 26.5 Simulator, app and share extension (`BUILD SUCCEEDED`).
- Simulator screenshots of every screen against the boards: Inbox (light and dark), Reader (light and dark), a List, Lists, Search with results, Settings, First run, the note and todo editor. They live in `test-results/ios/` after a run.

## Manual checklist (needs a device and the Apple team)

The share extension and the shared Keychain need real signing, so these are checked by hand on a phone with a development build:

1. Set the team in Xcode (or EAS credentials) for both targets; check both have the App Group and the Keychain group, and that the share extension is embedded.
2. Sign in with the email link: once with the link opened inside the sign-in sheet, once with it opened from Mail. Both land on "You're in."
3. Safari: share a long article to Pluck. "Plucked." appears in under a second with the title; the item's text in the app is the page as Safari rendered it. Select a sentence first and share: it becomes a highlight.
4. Share sheet: toggle a tag chip, "Add to <last list>", change the kind, type a note, Done. All four show on the item. Without touching it, the sheet closes after two seconds.
5. Share text from Notes with three links: three items. Text with no links: a Note.
6. Share a photo and a PDF from Files: the item appears at once; within a minute the PDF's text and the photo are on it (the worker must be running, or the cron tick on Vercel).
7. Airplane mode, share a page: "Plucked. Will sync." Back online, open the app: the Inbox shows "N to sync" briefly, then the item.
8. Sign out in the app, then share: "Not signed in." and "Open Pluck to sign in" opens the app.
9. Inbox: swipe right to Later, left to Archive; pull to refresh. Reader: Later, Archive, Tags, List, Share, Original, and the reading position comes back on the web.
10. Settings: Copy the connector URL; "Delete everything. No, really." opens account deletion on the web; Sign out.
11. Put Pluck first in the share row (Settings tip) and check the icon in the share sheet.

## Known gaps

- Making a highlight is web and extension only; the app shows highlights but cannot make them yet.
- Account deletion opens the web page in Safari (the API only deletes from a signed-in browser session); App Review accepts this when the link goes straight to deletion, but check the current guideline before submitting.
- "Open Pluck to sign in" in the share extension uses the responder chain to open the app; if App Review objects, replace it with a line telling the person to open Pluck.
