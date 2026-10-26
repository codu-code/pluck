# Design boards, brand and the original brief

How Pluck works now is in [`docs/architecture.md`](../architecture.md). This folder holds what it was designed and built from.

- `design/`: the visual source of truth. Copy values from these boards, never round them.
- `brand/`: tokens, icons and the wordmark.
- `pluck-technical-spec-v2.md`, `pluck-product-spec-v2.md`: the brief from 24 October 2026, kept as background. Where they and the code disagree, the code is right; `CLAUDE.md` lists the decisions that changed.

## Design

`design/` holds the canvas as 43 `.dc.html` artboards plus `canvas.json` (the index with each board's title, size and position). Each file is a self-contained HTML page with inline styles, so the exact paddings, sizes, radii and colours are readable in the markup.

Two of the boards are shared components the others import: `Logo.dc.html` and `Icon.dc.html`, ported to `packages/ui`.

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
| `SiteChrome.dc.html`, `SiteIPhone.dc.html` | The "Soon." pages from while the Chrome Web Store and App Store listings were in review |
| `Cookies.dc.html` | The cookie banner |
| `ConnectLoop.dc.html` | The 10-second "connect your AI" loop: live, with timing, frames and spec. The same CSS ships as `apps/web/components/ConnectLoop.tsx`; `motion/connect-loop.html` is the standalone page that `scripts/record-loop.mjs` records |
| `AppStore1.dc.html` to `AppStore5.dc.html` | App Store screenshots at 1320 × 2868 (6.9 inch), built from the iOS boards |

## Brand

`brand/tokens.json` is the palette, type, layout and the seven kind glyph paths. `brand/*.svg` are the app icon (forest, mint, dark; regenerated with every other icon size by `node scripts/icons.mjs`, from `packages/ui/src/icon.json`), favicons at 32 and 16, the bare glyph, and the wordmark. The wordmark SVG uses the live Fredoka font; convert to outlines before using it anywhere the font is not loaded.
