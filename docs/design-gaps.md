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

| Screen | Built from | What to decide |
|---|---|---|
| Loading ("Plucking…") and "Nothing to pluck on this page" | Extension board | Both are a single line today |
| "Pluck all N tabs" in progress and done | Extension board footer | Progress and the "Plucked N tabs into …" result |
| Options, API key entry | Extension board options | The key field that replaces the account row |

### iOS app

| Screen | Built from | What to decide |
|---|---|---|
| Sign in, and "Use your own server" | IOSFirstRun and Brand | The whole screen; the server and API key fields |
| Lists (the index) | Web Lists board, IOSLists | Row design, empty state |
| Note, Todo and Thing editor | Web ItemNote board | Title field and first-line title, the Done tick for todos and things |
| Tag, list and "Add to list" sheets | Web pickers | One sheet for three picks today |
| Inbox empty and Later empty | Empty board | Copy and art |
| Reader: image items, "Plucking the page", "Couldn't read this page" | IOSReader | States the board does not draw |
| New note button in the Inbox header | None | Where creating a note on the phone lives |
| Share extension: working, failed | IOSShare | Only plucked, signed out and offline are drawn |

### Native share sheet

The share sheet is SwiftUI (`apps/ios/targets/share/ShareView.swift`) with the token values copied in; fonts are the system's, not Geist (extensions keep their size down). Worth a look on a phone next to the board.

## Departures from a board

| Where | Board says | Built | Why |
|---|---|---|---|
| Extension, already plucked | "Pluck again as new" | "Pluck it again" (moves it back to the Inbox) | A URL is never plucked twice (CLAUDE.md, re-pluck rule) |
| Extension, To list | Last used list preselected | "None" preselected, last used first and marked | Preselecting would file every pluck into that list |
| Extension, kind row | All seven kinds active | Note, Todo, Thing shown but disabled | A link cannot become one |
| Extension options | "So search and Claude can read…" | "So search and your AI can read…" | Product words: never one vendor as the only option |
| Home | "Save anything", "your saves", "marked as saved", `kind=idea` | "Pluck anything", "your plucks", "plucked", `kind=note` | Product words; there is no Idea kind |
| Home | "Plucked." stamp at 40px from the top | 12px | It covered the shortcut keys in the drawn app |
| Home, AI card | Chat replies with a border | No border | Design detector: cards inside cards |
| Home, hero lede and AI card | One flowing paragraph | One sentence (or quoted question) to a line | Lines broke mid-sentence ("We / won't nag.") |
| Home, dark band | Flowing text | Four set lines on wide screens; each thing kept whole on phones | "Half / an idea." split a phrase across lines |
| Connect your AI | h1 at up to 132px | Up to 92px | Design detector: a 41-character headline at that size fills the screen |
| Connect your AI, Self-hosted tab | "Point it at the local server it starts." | "Add the line … as a local (stdio) server." | That is how the bridge works |
| Privacy and Terms | 760px column | Text at 60ch | Design detector: lines over 80 characters |
| Privacy | "We count sign-ups and plucks per day as totals" | Removed | We count nothing |
| Privacy | Delete "within 24 hours"; "one cookie" | "At once"; a second cookie for the home page paste box | Matches what the code does |
| Terms | "no delete tool" | "a delete tool only if you grant it separately" | The `library:delete` scope exists |
| All site footers | "Made in Dublin." | Removed | Asked for by Niall |
| iOS first run | "You never need to open this app to save." | "…to pluck." | Product words |
| iOS Search | Results show which list they are in | They show the status | Search results do not carry list membership |
| iOS Inbox | Swipe right for Later | Also swipe left to Archive | Two moves the reader toolbar already has |
| iOS share sheet | Kind row, all seven | Note, Todo and Thing disabled for links | A link cannot become one |

## Placeholders to fill

Listed on every test run by `scripts/placeholders.test.ts`; the current set:

| Placeholder | Where | What it is |
|---|---|---|
| `[CONNECTOR GIF]` | Settings, AI tools | A 20-second clip of adding the connector in an AI tool. A drawn three-line conversation stands in until then |
| `[CHROME STORE URL]`, `[FIREFOX ADDONS URL]`, `[APP STORE URL]` | `apps/web/lib/site.ts` (home page buttons) | Store listings |
| `[DATE]` | Privacy, Terms | "Last updated" |
| `[LEGAL ENTITY]`, `[ADDRESS]` | Privacy | The company behind Pluck |
| `[RESPONSE DAYS]` | Terms | Takedown response time |
