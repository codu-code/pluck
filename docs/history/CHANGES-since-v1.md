# Changes since v1 (23 to 24 October 2026)

## Data model
- Kinds are seven: Read, Watch, PDF, Image, Note, Todo, Thing. Idea and Study are gone. Idea became Note. Study became a Todo with a `study` tag and a due date.
- Notes have an optional title; the first line of the body is the title when none is set. Body is plain text. No highlights on notes.
- Lists replace Collections. Ordered, purpose line, per-item note and tick. An item can be in many lists.
- List visibility is Private or Public. Unlisted is cut. `publicId` is gone.
- Smart lists are cut. `lists.kind` and `lists.query` are gone.
- Items in any list are exempt from expiry.
- New fields: `items.lastTouchedAt`, `items.archivedReason`, `items.titleIsDerived`, `listItems.noteBy`, `lists.lastActivityAt`, `users.settings.expiryDays` and `expiryScope`. New `reports` collection.

## Expiry and archive
- Expiry length is a user setting: 14, 30, 60, 90 days or Never. Default 30. Scope: Inbox and Later, or Inbox only.
- Expiry moves to Archive. Nothing is deleted. Archive stays searchable, Restore works, and the "expired" filter shows what moved.
- "Archive it all. No, really." in Settings and the digest: `POST /items/archive-stale` with a dry run for the count.

## Capture
- Multi-link paste: `POST /items` accepts `urls[]` (max 50) or free text with URLs in it. Shared URL extractor in `shared-schemas/urls.ts`, used by web, iOS share, email-in and MCP.
- iOS share sheet saves in place and never opens the app. It gains an optional one-line note field that cancels the auto-close. Chips: two most-used tags plus "Add to <last list>".
- Extension popup: "to list" picker, "pluck all tabs into a dated list", max height 460 px.
- Failed extraction gets "Try the Wayback copy" (client-side link).

## Lists and sort
- Kind filter row is five chips: All, Links, Notes, Todos, Things. Links expands to the four link kinds.
- Sort toggle on Inbox and Later: Newest or Untouched first (`lastTouchedAt`).
- Shortcut `a` adds to a list. Inside a list: Space ticks, `n` notes, Shift+J and Shift+K reorder.
- Public list page has a Report link that posts to `POST /reports`.

## AI connector
- Positioning is "Ready for your AI, whichever one you use." Claude is named only alongside ChatGPT, Cursor and Claude Code. No "dumb on purpose" line.
- "by Claude" marks are "by AI". Settings section is "AI tools".
- Twelve tools: `search_items`, `list_items`, `get_item`, `save_item`, `batch_update`, `list_tags`, `create_tag`, `list_lists`, `get_list`, `create_list`, `update_list`, `get_digest`. No `add_to_list` (folded into `update_list`), no `update_item` (folded into `batch_update`), no `search_library` (renamed `search_items`).
- Four prompts: `tidy_inbox`, `build_list` (replaces `group_recent`), `content_ideas`, `weekly_review`.
- MCP is the only public API. No other integrations get built.

## Marketing site
- Five pages: Home, Connect your AI (MCP install tabs, tools, prompts, limits), Open source, Privacy, Terms.
- Terms cover age 16+, public list rules (no illegal content, CSAM, harassment, doxxing, spam, malware, infringement), takedown, 90 days' notice if the free service ends, Irish law.

## Brand
- Wordmark: "pluck" in Fredoka 700 with three sparks off the k. Icon: a drawn p with the same sparks, heavier with two sparks under 20 px. No underline, no swoosh.
- Palette: Forest `#1E5C45` (brand), Sea green `#34A07C` (sparks), Mint `#7FD3AE` (ticks and highlights), Clay `#9A5536` (by AI). Cool off-white ground, green-black ink. No cream.
- Logo and Icon are shared components on the canvas; every board uses them.

## Cut
- Idea and Study kinds, Smart lists, Unlisted, read/unread filters, "Surprise me", any API beyond MCP.
