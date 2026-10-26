# Pluck — Product and Design Spec v2

> **The brief Pluck was built from, kept as background.** Where it and the code disagree, the code is right: see `docs/architecture.md` for how Pluck works now and "Decisions that differ from the spec" in `CLAUDE.md`.

24 October 2026. Supersedes v1. The design canvas (now 43 boards) is the visual source of truth; this doc is the written one.

## What Pluck is

Pluck is the fastest way to grab a link and the cleanest way to hand your library to the AI tool you already use. You pluck things from anywhere in one tap: articles, videos, threads, PDFs, a note, a thing to buy. Pluck keeps the page, not just the link, and gets out of the way. When you want to do something with your saves, you ask your AI, which reads your whole library over one MCP connector. There is no AI inside the app. That is a feature, and it is what makes Pluck work with Claude, ChatGPT, Cursor or anything else that speaks MCP.

**Who it is for.** Builders, writers and students who save a lot and want a tool that does not pretend to be clever. People who left Pocket and Omnivore. People who already live in an AI tool and want their saves there. And, first of all, Niall.

**The promise.** Pluck it. Sort it later.

**What is different.**

- Saving takes one tap from anywhere, and the page itself is kept.
- No AI tagging mess, because there is no AI in the app. Your tags are your tags. Your AI only touches them when you ask.
- The library is in your AI in 30 seconds. One connector URL, twelve tools, four prompts that do the tidying, list-building and idea work on request.
- Lists are what you are making: a book, an issue, a talk, a trip, things to buy. Private by default. Public with one switch.
- Free, open source, and runs on a shared database that costs nothing extra. It will not shut down with two weeks' notice.

**What it is not.** Not a beautiful long-form reader. Not a second brain. Not a social network. Not an AI product. It is the inbox that feeds the thing you actually use to think.

## Principles

1. **Saving never waits.** Under 300 ms to "Plucked" on every surface. Title and cover arrive a moment later. No spinner ever blocks a save.
2. **No model inside.** The app stores, shows, groups and searches. It never summarises, suggests or tags on its own. If a feature needs a model, it becomes an MCP prompt instead.
3. **Your AI does what you ask, while you watch.** Every change it makes is marked "by AI" and undoable in bulk. It can never delete.
4. **One inbox, many lists.** Everything lands in one inbox and one search. Lists are how you work. An item can sit in as many lists as you like, each with its own note and tick.
5. **Private by default, public by choice.** Nothing is visible until you flip one switch on one list. A public list shows titles, covers, your notes and links out. It never shows stored page text.
6. **Nothing rots, and nothing is deleted.** Items untouched for 30 days (your number) move to the Archive. The Monday email warns a week before. Archived items stay searchable and restore in one tap. Items in a list are exempt, because a list is a plan.
7. **No nags.** No streaks, badges, unread counts or read/unread filters. Opens are tracked for expiry and the digest, never shown as guilt.
8. **Own your data.** Export everything as JSON and Markdown in one click. The page content is stored, not just the URL. Self-host in one command.
9. **Looks human.** No AI-tool design tropes. Impeccable enforces the rules in CI.

## Core objects

Six nouns and one verb. The UI uses these words and no others.

| Object | What the user sees | Rules |
|---|---|---|
| **Pluck** (the verb) | The act of saving. "Plucked" is the confirmation everywhere | Never "saved", never "bookmarked" |
| **Item** | One plucked thing: cover, title, site, excerpt, tags, kind glyph, when | Deduped by URL. Notes, todos and things are items with no URL |
| **Kind** | Read, Watch, PDF, Image, Note, Todo, Thing | Seven. Set at save time, changed by you or by your AI on request. The filter row shows Links (Read, Watch, PDF, Image), Notes, Todos, Things |
| **Status** | Inbox, Later, Archived, Done (Todo and Thing) | Inbox is untriaged. Later is kept on purpose. Archived is finished, let go, or expired. Never deleted |
| **Tag** | A short label you made. Tags your AI made carry a small "by AI" mark until you touch them | No automatic tags, ever |
| **List** | A named, ordered group with a purpose: "Book, chapter 3 sources", "Kitchen reno, to buy", "Best MCP reading". Each item in a list carries its own note and a tick | Manual only. Private or Public. Your AI can create one when you ask, always private |

**Removed in v2.** Idea (now Note). Study (now a Todo with a `study` tag and a due date). Smart lists (search filters cover it). Unlisted visibility (Private or Public, nothing between).

**Notes.** A Note has an optional title. If none is set, the first line of the body is the title. Body is plain text with line breaks, edited in place on the item page, saved as you type. Notes have no highlights. A Note can be turned into a Todo or a Thing from the kind picker.

**Secondary.** Highlight (a quote and a note on an item), Note-on-item (free text on any item or list), Public page (the read-only view of a public list), Digest (the weekly email, rule-based), Import, Export.

## v1 feature list

**In.**

| Area | Features |
|---|---|
| Capture | iOS share sheet (saves in place, the app never opens), Chrome and Firefox extension (pluck on click, highlight from selection, pluck all tabs into a dated list, "to list" picker), web paste box (one link, many links in one paste, or a note), email-in, MCP `save_item`, iOS Shortcut |
| Content | Page kept and readable, PDFs, YouTube with transcript from the extension, X posts, images, dark mode, reading progress, Wayback fallback link on failed pages |
| Organise | Kinds, status, your own tags, bulk select, keyboard shortcuts. Lists: ordered, purpose line, note and tick per item, drag to reorder, add from inbox, extension or share sheet. Sort by Newest or Untouched first |
| Find | Text search over title, note, tags, list names and body. Filters by kind, tag, list, status, date |
| Use | Highlights and notes, weekly digest (forgotten, due, oldest, quiet lists), expiry to Archive with a user-set length, "Archive it all" one-tap clean-up, the MCP connector with 12 tools and 4 prompts |
| Share | Make any list public with one switch: a clean read-only page at `getpluck.io/@you/list-name` with your notes, links out, an OG image, a view count only you see, a "Pluck this list" button and a Report link |
| Move in and out | Import Pocket CSV, Omnivore export, Raindrop CSV, bookmarks HTML. Export JSON plus Markdown, per list too |
| Account | Magic link and GitHub login, a handle for public pages, API keys, account deletion, self-host with Docker Compose |

**Out, on purpose.**

- Any model call inside the app: summaries, auto-tags, suggestions, clustering, semantic search
- Following, comments, likes, a public feed, a discover page. A public list is a page, not a network
- Collaborative lists (v1.1 if asked for)
- Smart lists, Unlisted visibility, the Study and Idea kinds
- Read/unread markers or filters. "Surprise me" random picks
- Any public API beyond MCP. Raycast, Alfred and Shortcuts people get an API key and one documented endpoint
- Text-to-speech, a polished reader with fonts and themes, a full RSS reader
- Android native app (the PWA covers it), browser side panel (v1.1), headless Chrome for hard pages (v1.1, behind a flag)

## The loop

Five ways in, one inbox, two ways to act on it (you, or your AI when you ask), two ways out (Archive, or a public list and export). Pluck itself only ever does the middle: store, show, search, nudge.

The loop closes when a draft or a plan your AI wrote gets plucked back in as a Note, so the library grows with what you made, not just what you collected.

## Flow details

Written as the person experiences it, with the one thing that must be true at the end. Timings are budgets.

**Flow 1. Pluck from iOS.** Tap Share in Safari, YouTube, X or any app. Pluck sits in the top app row. Tap it. A half-height sheet says "Plucked" with a tick within 300 ms, shows the title, two chips from your most-used tags and a third chip "Add to <last list>", the kind row, and an optional one-line note field. Tapping the note field stops the auto-close. Otherwise it closes itself after 2 seconds. The app never opens. Must be true: the item is in the inbox even if the phone was offline.

**Flow 2. Pluck from the extension.** Click the icon or press Alt+Shift+P. The popup opens already saved: "Plucked", the title, Undo. Below, a tag picker, the kind row, a "to list" picker that remembers the last list, a note box. If text is selected, the context menu offers "Pluck selection as highlight". Must be true: the page's rendered HTML was sent, so a paywalled page you were logged into is readable later.

**Flow 3. Pluck from the web app.** A paste box at the top of Inbox. Paste one URL and Enter. Paste a block of text with five URLs in it and get five plucks. Type a sentence and it becomes a Note, or pick Todo or Thing. Todo and Thing ask for an optional due date. Must be true: no modal, no second screen.

**Flow 4. Pluck by email.** Forward a newsletter to your `pluck+<token>@in.getpluck.io` address. It arrives as a Read item with the sender as author. Must be true: the address is in Settings with a copy button and a regenerate link.

**Flow 5. Pluck from your AI.** In any chat with the connector on: "pluck this as a note: <text>" or paste a URL and say "pluck that". Your AI calls `save_item` and confirms with the title. Must be true: the item shows source: mcp so you can see what was saved by AI.

**Flow 6. The page arrives.** Within 10 seconds the card gains a title, a cover and a reading time. Nothing else changes. No tags appear, no summary, no suggestions. Must be true: if extraction failed, the card says "Couldn't read this page" with Retry, Open original and Try the Wayback copy, and nothing is hidden.

**Flow 7. Daily triage.** Open Inbox. On web, `j` and `k` move, `l` keeps for Later, `e` archives, `t` tags, `a` adds to a list, `o` opens, `x` selects for bulk. A sort toggle switches Newest and Untouched first. On iOS, swipe right for Later, swipe left for Archive, long-press for tags, kind and list. Must be true: triaging 20 items takes under two minutes and never opens a modal.

**Flow 8. Search.** Press `/` anywhere on web, or tap Search on iOS. Results update with a 150 ms debounce over title, notes, tags, list names and body. Each result shows the best snippet. Filter chips for kind, tag, list, status, date. Must be true: 5,000 items return in under 300 ms. If you want "by meaning", the empty state says: ask your AI.

**Flow 9. Write a note.** Type in the paste box, or open any Note. The item page for a Note is an editor: a big title line and a plain-text body, saved as you type. The right column has tags, kind and lists, like any item. Must be true: a note written on the phone is on the web before you look.

**Flow 10. Ask your AI to tidy.** Run the `tidy_inbox` prompt or say "tidy my Pluck inbox". It reads the inbox and your tag list, proposes a tag or two per item from your existing tags and a keep, later or archive decision, in a table. You say yes, or change rows. It applies in one `batch_update`. New tags are only created if you say so. Must be true: every tag it added carries a "by AI" mark, and Settings has "Remove everything AI tagged this week".

**Flow 11. Ask your AI for a list.** "Make me a reading list on local-first sync from what I've plucked, best first, with a line on why each matters." It searches, reads the strongest items with `get_item`, calls `create_list` with items in order and a note per item, and says the list is private. "Make it public" is a one-line follow-up that calls `update_list`. Must be true: the list shows createdBy: mcp and every note it wrote carries the "by AI" mark.

**Flow 12. Monday email.** 06:00 local: items a week from expiry (keep, or let them go to the Archive), items due this week, your five oldest inbox items, lists with no activity in 30 days, and an "Archive it all" link. Signed one-tap links, no login, 7-day expiry. Plain rules, no model. The same list is `get_digest` for your AI and the `weekly_review` prompt walks it. Must be true: it reads well in plain text, says plainly that nothing is deleted, and takes under 3 minutes.

**Flow 13. Expiry and clean-up.** Settings, Expiry and archive: move to Archive after 14, 30, 60 or 90 days untouched, or Never. Applies to Inbox and Later, or Inbox only. Items in any list are exempt. "Archive it all. No, really." moves everything in Inbox and Later older than the expiry length to the Archive right now, after a yes. Must be true: the Archive filter "expired" shows exactly what moved, and Restore puts any of it back.

**Flow 14. Make a list for a project.** From Lists, New list: a name and an optional one-line purpose. Add items three ways: from the inbox with `a`, from the extension popup, or from the share sheet's third chip. Inside the list, drag to reorder, tick an item when it is read, bought or done, and write a note per item that lives only in that list. Must be true: an item in three lists shows three different notes, and a tick in one list does not change the item's status elsewhere.

**Flow 15. Share a list.** In the list header, one switch: Private or Public. Public asks for your handle once, then shows the link `getpluck.io/@niall/best-mcp-reading` with a copy button. The public page is clean: list name, purpose, your name, items in your order with cover, title, site and your note, links out. No ticks, no tags, no page text. A "Pluck this list" button copies the list into the visitor's own Pluck, or opens sign-up. A Report link sits in the footer. Must be true: flipping back to Private returns a 404 within a minute, and stored page text was never served.

**Flow 16. Import.** Settings, Import, drop a Pocket CSV, Omnivore zip, Raindrop CSV or bookmarks HTML. Progress bar with done and failed. Items land as Archived with the import's own tags only. Must be true: it runs in the background and the page can be closed.

**Flow 17. Export.** Settings, Export, one button. A zip by email and as a download: items.json, one Markdown file per item with front matter, highlights and notes, and one per list. Any single list exports from its own page. Must be true: it works on day one.

## Web app screens

Nine screens plus one public page. A narrow left rail (Inbox, Later, Lists, Archive, Settings) and a top bar holding the paste box and search. No dashboard, no stats, no suggestions tab.

| Screen | Route | What is on it | Primary action | States |
|---|---|---|---|---|
| Inbox | `/` | Paste box, kind chips (All, Links, Notes, Todos, Things; Links expands), sort toggle, rows newest first, bulk select | Triage: Later, Archive, tag, add to list | Empty: "Nothing plucked yet." with the extension link, the iOS link, and a sample URL you can press |
| Later | `/later` | Same rows, a quiet "30 days" pill on items near expiry | Open and read | Empty: "Nothing kept for later." |
| Item (link) | `/i/:id` | Title, byline, reading time, cover, clean text with highlights. Right column: note, tags, kind, lists it sits in, source, Open original | Read, highlight, note | Failed extraction: the URL, Retry, Open original, Try the Wayback copy, and "Pluck it from the extension to keep the page" |
| Item (note) | `/i/:id` | Editable title line and plain-text body, saved as you type. Same right column, no highlights | Write | New note opens straight into the editor |
| Search | `/search?q=` | Query, filter chips, results with the best snippet | Open | No results: nearest text matches, and "Want it by meaning? Ask your AI." |
| Lists | `/lists` | Your lists: name, purpose, ticked count, visibility, last added. New list at the top | Open, New list | Empty: "Lists are what you are making. Make one, or ask your AI to build one from what you've plucked." |
| List | `/l/:id` | Header with name, purpose, Private/Public switch and (if public) the link and view count. Rows in your order with drag handle, tick, title, site and the per-list note inline. Export this list. Copy for your AI | Add, reorder, tick, note | Empty: "Add from the inbox with `a`, or pluck straight in from the extension." |
| Public page | `/@handle/slug` | Read-only. Name, purpose, author, items in order with cover, title, site and note, links out. "Pluck this list". Report link. Clean OG image | Pluck this list | Private or unknown: a plain 404 with the Pluck mark |
| Archive | `/archive` | Rows with filters: all, by you, expired, imported. "Nothing is ever deleted, and search still finds it." | Restore | |
| Settings | `/settings/*` | Profile and handle, AI tools (connector URL, install steps per client, Test it), Expiry and archive (length, scope, Archive it all), Tags (manage, merge, "Remove everything AI tagged this week"), Email-in, API keys, Import, Export, Delete account | Save | |

**The row.** 64 px: a small cover or site initials on the left, title on one line, site and reading time, one line of excerpt, tags on the right, kind glyph and a short date in the corner. Hover or focus reveals Later, Archive, Tag, List, Open. Rows, not cards. No card-in-card, no shadows.

**The reader.** Max width 680 px, 18 px serif body, line height 1.6. Select text for a two-button floating toolbar: Highlight, Note. Keyboard: `h` highlight, `n` note, `e` archive, `l` later, Esc back. Progress saves as you scroll.

**Shortcuts everywhere.** `/` search, `c` paste box, `j` `k` move, `o` open, `l` later, `e` archive, `t` tags, `a` add to list, `x` select, `?` cheat sheet. Inside a list: Space ticks, `n` notes, Shift+J and Shift+K reorder.

## Browser extension screens

**Popup, already plucked.** Opening it saves the current tab. Top: a tick, "Plucked", the title on one line, Undo. Middle: tag picker, the kind row (seven), a "to list" picker that remembers the last list, a note box. Bottom: Later, Archive, Open in Pluck. Footer: "Pluck all 7 tabs into a new list, '24 Oct tabs'". 360 px wide, never taller than 460 px.

**Popup, already in the library.** Opens on that item: title, tags, Open in Pluck, and "Pluck again as new".

**Popup, signed out.** One button: Sign in. A small link: Use your own server.

**Popup, offline or failed.** "Couldn't reach Pluck. Will retry." The icon shows a dot until it clears.

**Options.** Server URL (default getpluck.io), sign in or API key, default kind, shortcut reminder, "Send page content with plucks" (on, explained in one sentence), "Capture YouTube transcripts" (on).

**Context menus.** Pluck link. Pluck selection as highlight. Pluck image. Pluck page.

**Badge.** A tick when the page is already plucked. A dot when a pluck is queued.

## iOS screens

The share sheet is the product on iOS. It saves in place, like Pocket did. The app behind it is an inbox and a reader, and the only time it has to open is sign-in.

**Share sheet.** A half-height sheet. Tick and "Plucked" at once. Title. Three chips: your two most-used tags and "Add to <last list>". The kind row. An optional one-line note field, which cancels the auto-close when tapped. Done. Closes itself after 2 seconds. Signed out: "Open Pluck to sign in". Offline: "Plucked. Will sync."

**Tabs.** Inbox, Later, Search, Lists. Settings behind the avatar.

| Screen | What is on it | Gestures |
|---|---|---|
| Inbox | Rows newest first, pull to refresh, a sync pill if plucks are queued | Swipe right: Later. Swipe left: Archive. Long-press: tags, kind, add to list. Tap: open |
| Later | Same rows with the expiry pill | Same |
| Reader | Title, byline, reading time, native text, highlights, a bottom bar: Later, Archive, Tags, List, Share, Original | Select text to highlight |
| Note | Title and body editor, native text input | |
| Search | Field, filter chips, results with snippets | Tap to open |
| Lists | Your lists with purpose, count and visibility. Inside: ordered rows with a tick and the per-list note, drag handle in edit mode, the share switch and link in the header | Tap to tick, long-press for note, share from the header |
| Settings | Account and handle, AI tools (connector link), server (Advanced), tags, offline cache size, "Put Pluck first in Share" tip, delete account | |

**Offline.** The inbox and the last 200 opened items are cached. Plucks made offline show a sync pill and send when online.

**Before the app ships.** An iOS Shortcut named "Pluck" in the share sheet. Settings on web has an "Add the Pluck Shortcut" button with the API key filled.

## The AI connector

The connector is the product's second half. It has to feel like your AI has read your library, not like it is poking an API. Pluck speaks MCP, so Claude, ChatGPT, Cursor, Claude Code and any other MCP client use the same URL. Claude is named only as one of them.

**Setup.** Settings, AI tools: the connector URL with a copy button, install steps for Claude, Claude Code, ChatGPT, Cursor and self-hosted, a 20-second GIF, and a "Test it" button that opens your AI with "What did I pluck this week?" prefilled. Self-hosters without a public URL get `npx @getpluck/mcp` with their API key.

**The four prompts.** These are the only "AI features" Pluck has, and they live in your AI tool.

| Prompt | You say | It does | You see |
|---|---|---|---|
| `tidy_inbox` | "Tidy my Pluck inbox" | Reads the inbox and `list_tags`, proposes tags from your existing list and keep, later or archive per item | A table. You say yes or edit. One `batch_update`. New tags only on your word |
| `build_list` | "Make a reading list on MCP auth, best first" or "Group what I plucked this month into lists" | Searches, reads, proposes one or more lists with items in order and a line per item | You pick, it calls `create_list`. Private until you say otherwise |
| `content_ideas` | "Three blog ideas from what I plucked on MCP" | Searches, reads the best five in full, drafts angles with sources | Three angles. Offer to make a list of the sources and pluck the draft back in as a Note |
| `weekly_review` | "Run my weekly review" | Walks `get_digest`: expiring, due, oldest, and lists with no activity in 30 days | Keep, let go, or do it now, applied as you answer |

**Example conversations the demo must nail.** "What did I pluck about MCP auth?" (search, then read the top 3, short list with links). "Pluck this as a note: an MCP server for Assemble's estimates" (save, confirm). "Make me a reading list on local-first sync from what I've plucked, with a line on why each matters, and make it public" (search, read, `create_list`, `update_list` to public, hand back the link). "Add everything tagged kitchen to my Kitchen reno list as things to buy" (`batch_update` kind, `update_list` add). "What's rotting in my library?" (digest, five expiring items, offer to archive).

**What your AI may never do.** Delete (the scope is not granted). Create a tag without being asked. Change a human tag. Change a list's purpose line. Make a list public without an explicit "make it public" in the same conversation. Anything destructive asks a yes or no first.

**Tone of tool results.** Cards, not JSON. Titles first. "What did I pluck this week" is one tool call and one screen of text.

## Brand and voice

**The idea.** "Pluck it." Said the way you'd say the other thing. It is the shrug of someone who has stopped pretending they will read it now. Pluck it, deal with it later, or don't. The brand gives you permission to save without guilt, because the app does not nag and your AI will sort it when you care.

**Tone.** Dry, short, Irish. Confident, not loud. The joke is implied, never spelled out. We never write the swear word, never wink with an emoji, never explain the pun. If a line needs the joke explained, cut it.

**Taglines.** "Pluck it." (the mark). "Pluck it. Sort it later." (the landing page). "Pluck now. Think later. Or never." (the launch post). "Ready for your AI. Whichever one you use." (the connector page).

**Copy rules.**

- The verb is pluck. The confirmation is "Plucked". Never "saved", "bookmarked", "added".
- Second person, plain words, no exclamation marks, no emoji in the product.
- Short. If a sentence has a comma, try to lose it.
- States say what happened and what to do next: "Couldn't read this page. Open the original." Never "Oops". Never "Something went wrong".
- No AI words anywhere in the app. Not "smart", not "AI-powered", not "magic". The connector section says "your AI" or "AI tools". Never name one vendor as the only option.
- Expiry copy always says where things went: "to the Archive", "nothing is deleted".
- Empty states are an invitation, not an apology: "Nothing plucked yet." then the three ways to start.
- Edgy, not rude. The app never swears at the user, never mocks a save, never shames the pile.

**Sample lines.** Share sheet: "Plucked." Expiry: "Untouched for 30 days. Keep it, or it goes to the Archive." Archive: "Gone. Well, archived." Weekly email subject: "Five things you plucked and forgot." Clean-up: "Archive it all. No, really." Settings delete: "Delete everything. No, really."

**Name in text.** Pluck, capital P, never PLUCK, never pluck.io. The URL is getpluck.io.

## Visual design

Playful, drawn, and unmistakably made by a person. Dense enough to triage fast, quiet enough to read in. Reference points: Linear for density, Things for the share sheet, a good newspaper for the reader. Impeccable's PRODUCT.md and DESIGN.md are the canonical record once the first screens exist. This section is the brief they start from.

**Logo.** The wordmark is "pluck" in Fredoka 700, lowercase, with three short drawn sparks popping off the top-right of the k. The icon is a drawn "p" (thick stem, round bowl) with the same three sparks. Below 20 px the p gets heavier and drops to two sparks. No underline, no swoosh. Both are shared components on the canvas (Logo, Icon) and every board uses them.

**Colour.**

| Name | Hex | Use |
|---|---|---|
| Ground | `#F6F8F4` | Page background. Cool white with a green breath. No cream |
| Line | `#DDE2D8` | Full hairlines only |
| Ink | `#151A13` | Text and marks. Green-black |
| Ink 2 | `#525A4E` | Meta text. 6.8:1 on ground |
| Brand | `#1E5C45` | Wordmark, icon, primary buttons, toasts |
| Accent | `#34A07C` | The sparks and big full stops. Large marks only |
| Highlight | `#7FD3AE` | Ticks, highlights, the plucked badge, success. Ink on top |
| Clay | `#9A5536` | Marks what AI changed. Never purple |

Dark mode is the same system inverted: ground `#10130F`, surface `#191D17`, line `#2A2F27`, ink `#ECEFE8`, ink 2 `#A0A898`, clay `#D08A68`. Ships on day one on every surface.

**Type.** Fredoka 700 for the wordmark and marketing display only. Geist for the UI: titles 600, body 400, lists 14 px. Source Serif 4 for the reader at 18 px, line height 1.6, measure 680 px, real italics. Söhne and Tiempos if we pay for them.

**The AI tropes we ban.** One-sided accent borders (full hairlines or none; a selected row gets a tint, not a stripe). Cards in cards. Icon tiles above headings. Purple-to-blue gradients, glows, glassmorphism. Inter for everything. Grey text on coloured backgrounds. Pure black and pure grey. Bounce easing. Three-column feature grids with icons. Emoji in UI copy. Dashboards, stats, streaks, badges. Cream and beige grounds.

**Spacing and layout.** An 8 px grid. Rows 64 px. Left rail 220 px, content max 760 px, reader 680 px, right column 280 px. Whitespace does the structure work that borders usually do.

**Components.** Row, tag chip (filled for yours, outline with a small clay dot for AI's), kind glyph set (seven, one stroke weight, drawn for this product), paste box, kind chip bar with Links expander, sort toggle, Private/Public switch, floating highlight toolbar, toast, note editor. Built with headless primitives and our own styles, not a themed kit.

**Motion.** The share sheet tick draws itself in 200 ms. Rows slide out on archive in 150 ms ease-out. Nothing else animates.

**Icons.** Seven kind glyphs plus the handful of UI icons we need, drawn at 16 px. SF Symbols on iOS matched by name.

**How we keep it honest.** `/impeccable init` on day one. `/impeccable shape` before each screen. `/impeccable critique` and `/impeccable polish` before each ships. `npx impeccable detect` in CI fails the build on any banned tell.

## Marketing site

Five pages, all on getpluck.io, same brand, no cream.

- **Home.** A huge "Pluck it." with a live paste box that says "Plucked." when pressed. Then "1 tap / 0 nags / 30 s" rows, Lists, "Plug in the AI you already use", "Pocket shut down. Omnivore shut down." with import options, and a "Sort it later." close with install links.
- **Connect your AI.** "Ready for your AI. Whichever one you use." Install tabs for Claude, Claude Code, ChatGPT, Cursor and self-hosted. The twelve tools, the four prompts, what your AI can never do.
- **Open source.** "Free. Open. Yours." Self-host in one command, export, the page not just the link, public means public, your AI your call.
- **Privacy.** What we store, what we don't do, your AI tool's own terms, public lists, email-in, one cookie, where it lives, export and delete, your rights (Irish DPC).
- **Terms.** Age 16+, your library is yours, public list rules (no illegal content, nothing that sexualises minors, no harassment, doxxing, spam, malware or infringement), takedown, stored pages are a private cache, fair use and rate limits, 90 days' notice if the free service ever ends, Irish law.

Placeholders to fill before launch: legal entity, address, privacy and abuse emails, hosting provider and region, licence, repo URL, takedown response time.

## Onboarding and first run

The first five minutes must land three things: a pluck that keeps the page, a library that stays yours, and your AI reading it. Nothing else is introduced until those three happen.

1. Sign in with a magic link or GitHub. No profile form.
2. Pluck your first thing. The empty inbox offers three ways: press the prefilled sample URL, install the extension, or add the iOS app or Shortcut.
3. Watch it land. The row appears at once, the title and cover a moment later. A one-line note: "That's it. Pluck does not tag, sort or summarise on its own."
4. Connect your AI. A single row in the inbox: "Connect your AI" with the copy button and the 20-second GIF. It disappears after the first tool call.
5. Import is offered once as a row: "Bringing stuff from Pocket, Omnivore or Raindrop?" Never a blocker.

On iOS the first run is sign in, two frames showing the share sheet, and "Try it now" which opens Safari on a sample page. In the extension, the first click after sign-in shows a 3-line tip inside the popup, once.

## Accessibility, performance and offline

**Accessibility.** Every action has a keyboard path on web and a VoiceOver label on iOS. Colour never carries meaning alone. Contrast at least 4.5:1. Visible focus rings. The reader respects system font size on iOS and browser zoom on web. WCAG 2.2 AA.

**Budgets.** Pluck acknowledged on any surface: 300 ms. Share extension open to tick: 300 ms. Popup open to "Plucked": 300 ms. Title and cover on the row: 10 s. Searchable: 30 s. Inbox first paint, 50 rows: 400 ms. Search, 5,000 items: 300 ms. Web JS on the inbox route: under 150 KB gzipped. iOS cold start to inbox: 1 s.

**Offline.** iOS caches the inbox and the last 200 opened items and queues plucks. The extension queues plucks. The web app is a PWA with an app shell cached and an "offline, will sync" bar.

## Success metrics

The product works if plucks get used and the app stays fast and boring.

| Metric | Target at 8 weeks | Why |
|---|---|---|
| Use rate: items opened, highlighted, in a list or done within 30 days | 40% or more | The point. Pocket-style apps sit near 5% |
| Plucks per active user per week | 10 or more | Capture is frictionless |
| Share of plucks from the share sheet and extension | over 70% | The front doors work |
| Active users with at least one list of 5 or more items | over 50% | Lists are how projects happen |
| Public lists made, and sign-ups from a public page | 1 in 10 lists public, 20% of sign-ups from a shared list | The only growth loop that does not cost money |
| Connector adoption among active users | over 50% | Without it, Pluck is just a list |
| Weekly email open rate | over 60% | The loop closes |
| p95 pluck-to-searchable | under 30 s | Feels instant |
| Detector findings on main | 0 | The design stays human |

**Personal success (Niall).** Pluck replaces everything else by week 4, the Codú post a month starts from a `content_ideas` conversation, and the app has not needed a single model call to get there.

## Open questions

- [ ] Type: pay for Söhne and Tiempos, or stay on Geist and Source Serif at zero cost?
- [ ] Digest day: Monday 06:00 local, or user picks?
- [ ] Public list URL: `/@handle/slug` (handles for sharers only) or `/l/<short-id>` (no handles)?
- [ ] Should a public list show its "Pluck this list" count as light social proof? (Spec says no.)
- [ ] Is "Thing" the right kind name for buy-lists, or "Buy"?
- [ ] Expiry default: Inbox and Later, or Inbox only? (Spec says both.)
