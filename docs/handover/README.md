# Pluck — handover to Claude Code

24 October 2026. Everything needed to build v1 of Pluck (getpluck.io), an open-source URL saver with an MCP connector and no AI inside the app.

## Read in this order

1. `pluck-technical-spec-v2.md` — the build spec. Architecture, data model, API, auth, MCP server, extension, iOS, infra, conventions, and a numbered build order at the end.
2. `pluck-product-spec-v2.md` — what it is, the flows, every screen, the voice, the visual rules, the metrics.
3. `CLAUDE.original.md` — the standing rules as handed over. The live, edited version is the repo-root `CLAUDE.md`.
4. `CHANGES-since-v1.md` — if you read the v1 docs before, this is what moved.

## Design

`design/` holds the canvas as 43 `.dc.html` artboards plus `canvas.json` (the index with each board's title, size and position). Each file is a self-contained HTML page with inline styles, so the exact paddings, sizes, radii and colours are readable in the markup. Treat them as the visual source of truth and copy values from them rather than rounding.

Two of the boards are shared components the others import: `Logo.dc.html` and `Icon.dc.html`. Port those first into `packages/ui`.

Board map:

| File | What it is |
|---|---|
| `Brand.dc.html` | Logo, icon at every size, palette, type, glyphs, components, voice |
| `Loop.dc.html` | The product loop diagram |
| `Logo.dc.html`, `Icon.dc.html` | Shared brand components |
| `Main.dc.html` | Web inbox with kind chips, sort toggle, keyboard triage |
| `FirstPluck.dc.html`, `Empty.dc.html` | First-run states |
| `Later.dc.html`, `Search.dc.html`, `Archive.dc.html` | Web lists |
| `InboxDark.dc.html` | Dark mode and bulk select |
| `Item.dc.html`, `ItemNote.dc.html`, `ItemFailed.dc.html` | Reader, note editor, failed extraction |
| `Collections.dc.html`, `Collection.dc.html`, `PublicList.dc.html` | Lists index, one list (Private/Public switch), the public page |
| `Settings.dc.html` | AI tools, expiry and archive, tags, email-in, keys, import, export, delete |
| `Extension.dc.html` | Every popup state, options, context menu, badge |
| `IOSShare.dc.html`, `IOSInbox.dc.html`, `IOSReader.dc.html`, `IOSSearch.dc.html`, `IOSLists.dc.html`, `IOSSettings.dc.html`, `IOSFirstRun.dc.html` | iOS |
| `Claude.dc.html` | The connector in use (two example conversations) |
| `Email.dc.html` | The Monday digest |
| `Landing.dc.html`, `SiteClaude.dc.html`, `SiteOpen.dc.html`, `SiteSupport.dc.html`, `SitePrivacy.dc.html`, `SiteTerms.dc.html` | Marketing site: home, connect your AI, open source, support, privacy, terms |
| `SiteChrome.dc.html`, `SiteIPhone.dc.html` | "Soon." pages while the Chrome Web Store and App Store listings are in review |
| `Cookies.dc.html` | The cookie banner, for the day an analytics cookie arrives (none is needed today) |
| `ConnectLoop.dc.html` | The 10-second "connect your AI" loop: live, with timing, frames, spec and where it goes. The same CSS ships as `apps/web/components/ConnectLoop.tsx`; `motion/connect-loop.html` is the standalone page that `scripts/record-loop.mjs` records |
| `AppStore1.dc.html` to `AppStore5.dc.html` | App Store screenshots at 1320 × 2868 (6.9 inch), built from the iOS boards |

## Brand

`brand/tokens.json` is the palette, type, layout and the seven kind glyph paths. `brand/*.svg` are the app icon (regenerated with every other icon size by `node scripts/icons.mjs`, from `packages/ui/src/icon.json`) (forest, mint, dark), favicons at 32 and 16, the bare glyph, and the wordmark. The wordmark SVG uses the live Fredoka font; convert to outlines before shipping it anywhere the font is not loaded.

## Placeholders to fill before launch

Legal entity, address, privacy and abuse emails, hosting provider and region, licence, repo URL, takedown response time. They are marked `[LIKE THIS]` in the specs and the site boards.

## The one rule

No model calls on the server. Ever. AI features are MCP prompts in `packages/mcp`. A PR that adds one is declined.
