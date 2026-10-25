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
| Offline mark in the nav | every app page, offline | The iPhone's sync pill, in clay on a `--clay-line` hairline (the web has no clay wash token) | Whether the ink "offline, will sync" bar under it still earns its place now the nav says so; a clay wash token for the web |

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
| Offline pill in the tab bar | IOSInbox sync pill (syncBg, syncInk) | Its place (top of the tab bar, so every tab shows it; it pushes the bar up by a row), the cloud-struck-through glyph (drawn for this, on the 16-unit grid) |
| Reader: "Not on this iPhone yet." | The reader's "This one didn't load" state | Whether it should offer anything (it opens by itself when the connection is back) |
| Settings, Keep for offline reading | IOSSettings rows, the Privacy switch row | The switch above "Offline copy" and the footnote under Library |

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
| Lists, web and iPhone (Collection, IOSLists) | A leading tick; a ticked title struck through | Inbox rows with the order number and, on the web, a drag handle on hover; a trailing round mark worded by Kind (Read, Watched, Seen, Done); marked rows soften and gather under a header that folds; bulk select | Owner's call (25 October 2026): Lists look like the Inbox. The boards still draw the old rows |
| Public and shared Lists (PublicList) | 112 by 72 covers, 18 px titles, serif notes | The same 64 px Inbox rows, the List note as the second line, no marks | The same row everywhere an Item is listed. Worth a designer's look: the public page lost some of its reading feel |
| Archive, Search (Archive, Main) | Glyph-led rows, one long list | Inbox rows; the Archive in months ("October 2026") whose headers fold, remembered on the device | Owner's call: one row everywhere, and long Archives are easier to scan by month |

## Placeholders to fill

None left. `scripts/placeholders.test.ts` lists any that come back.

## Motion and the place you are on (25 October 2026, owner's call)

The boards show the active tab and nav link in ink with no motion, and the spec allows only the share-sheet tick and the archive slide. Now: the place you are on is Pluck green (`--action-ink` on the web, `actionInk` on iPhone: forest on light, mint on dark), the web nav eases its tint in over 160 ms, and the iPhone tab glyph draws itself in over 220 ms ease-out when its tab becomes active, with a selection haptic (the Draw On idea from SF Symbols, in Pluck's own glyphs). No bounce; Reduce Motion and prefers-reduced-motion turn the motion off.
