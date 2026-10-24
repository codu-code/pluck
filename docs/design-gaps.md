# Design gaps

What still needs a designer's eye. Three kinds: screens built without a board of their own (styled from the nearest board and the tokens), places the build departs from a board and why, and placeholders that need real content. Kept up to date by the build loop; tick things off or delete them as they are designed.

## Screens with no board of their own

Sign-in, consent, the OAuth error, extension connected, the email's one-tap pages, copy a list, offline, not found and the error pages now share one layout (`apps/web/components/Standalone.tsx`): the site's display type with the accent full stop, one sentence to a line, a short lede, the next step, and a drawn piece of the product beside it (the sign-in email with its "Sent." stamp, queued rows offline, the "by AI" mark on consent, the shortcut keys, the count for Archive it all, otherwise the app icon). Worth a designer's look, but no longer bare.

### Web app

| Screen | Route | Built from | What to decide |
|---|---|---|---|
| Admin | `/admin` | Settings board | Reports queue and kill switches (internal, low priority) |
| Settings, AI tools: connected tools | `/settings#ai` | Settings board shows one "Connected · last call" line | The list of connected tools (AI tools and our own extension) with Disconnect; whether the extension belongs in "AI tools" at all |
| Settings, Weekly email, import progress, export, delete account | `/settings` | Settings board (partly) | The states the board does not draw: import running and failed, export ready, delete confirmation |

### Browser extension

Loading draws the logo's three dashes in turn while the page is plucked (the Brand board's "pop off the k"); signed out says what the extension does; "Nothing to pluck on this page" says what to do instead.

| Screen | Built from | What to decide |
|---|---|---|
| "Pluck all N tabs" in progress and done | Extension board footer | Progress and the "Plucked N tabs into …" result |
| Options, API key entry | Extension board options | The key field that replaces the account row |

### iOS app

Designed in the iPhone polish pass (no board, built from the nearest board and the tokens, checked in the Simulator in light, dark and at large Dynamic Type): sign in and "Use your own server" (labelled fields, a hint for the key, scrolls at large sizes, `pluck://signin?server=…` fills the server); the Lists index rows and empty state; the tag, list and Add sheets (one sheet, the title in the list header, an empty state each); Inbox and Later empty, each with a drawn piece of the product (the share row with Pluck first, a row mid-swipe to Later); Search before a query, and list detail with nothing on it; the reader's image items (the picture at its own shape), "Plucking the page" (a spinner, and it checks back until the page lands) and "Couldn't read this page" (Open the original, Try again).

| Screen | Built from | What to decide |
|---|---|---|
| Note, Todo and Thing editor | Web ItemNote board | Title field and first-line title, the Done tick for todos and things |
| New note button in the Inbox header | None | Where creating a note on the phone lives |
| Settings, App icon | IOSSettings rows, the iOS picker pattern | Two rows (Light, Dark) with the icon and a tick; whether a third (the mint tile) earns a place |
| Share extension: working, failed | IOSShare | Only plucked, signed out and offline are drawn |

### Native share sheet

The share sheet is SwiftUI (`apps/ios/targets/share/ShareView.swift`) with the token values copied in; fonts are the system's, not Geist (extensions keep their size down). Worth a look on a phone next to the board.

## Departures from a board

The copy and behaviour departures for the site, the extension, the share sheet, iOS first run and iOS Search were folded back into the boards on 24 October 2026 (the boards now match the app). What is left is how native iOS behaves.

| Where | Board says | Built | Why |
|---|---|---|---|
| iOS Inbox | Swipe right for Later | Also swipe left to Archive | Two moves the reader toolbar already has |
| iOS Inbox, Later, Search, Lists | A large title fixed above the list | The title scrolls with the list and an inline title fades into a bar | How UIKit's large titles behave; at large text sizes it gives the list the room |
| iOS Inbox row | 72 tall | At least 72; grows with the text size | Fixed rows clipped at large Dynamic Type sizes |
| iOS tab bar, reader toolbar | Labels at 11 | 11 at every text size | What the system bars do; the labels broke mid-word at large sizes |

## Placeholders to fill

Listed on every test run by `scripts/placeholders.test.ts`; the current set:

| Placeholder | Where | What it is |
|---|---|---|
| `[CONNECTOR GIF]` | Settings, AI tools | A 20-second clip of adding the connector in an AI tool. A drawn three-line conversation stands in until then |
