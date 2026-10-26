# Pluck — Technical Spec v2

> **The brief Pluck was built from, kept as background.** Where it and the code disagree, the code is right: see `docs/architecture.md` for how Pluck works now and "Decisions that differ from the spec" in `CLAUDE.md`.

24 October 2026. Supersedes v1. Read with the Product and Design Spec v2 and the design canvas.

## Purpose and scope

Pluck is a fast, open-source URL saver with a first-class MCP connector. You pluck things from anywhere in one tap. The app stores them well, keeps the page, and lets you organise by hand. Any AI tool that speaks MCP does the thinking, through the connector, in that tool. There is no AI inside the app. No summaries, no auto-tagging, no embeddings, no clustering. That is the whole design: a small, fast, honest tool that any AI can sit on top of.

**Brand.** Pluck at getpluck.io. "Pluck it." Playful, drawn, human. The Product and Design Spec carries the voice and the visual rules.

**v1 surfaces.**

| Surface | Ships in v1 | Not in v1 |
|---|---|---|
| Web app (Next.js 16) | Inbox, reader, note editor, search, tags, lists with ordering, per-item notes and ticks, public list pages, settings (expiry, AI tools), import and export, marketing site, privacy and terms | Following, comments, feeds, collaborative lists, smart lists |
| Browser extension (WXT) | Save on click, tag picker, "to list" picker, pluck all tabs into a dated list, highlight from selection, context menus, page kept | Side panel, Safari build (later, inside the iOS bundle) |
| iOS app (Expo plus a Swift share extension) | Share-sheet save in place with tag chips, "add to last list" and a note field, inbox, lists, reader, note editor, offline cache | Widgets, App Intents, Android |
| MCP server (inside Next.js at /mcp) | 12 tools, 2 resources, 4 prompts, OAuth for any MCP client, API-key auth for scripts and self-host | A delete tool by default (behind a scope). Any other public API |
| Backend | REST API (used by our clients and the MCP layer only), Better Auth, page extraction and archiving, text search, public list pages with a narrow projection, email-in, expiry job, weekly rule-based digest | Any model call |

**Fixed decisions.** Next.js App Router with TypeScript. MongoDB on an existing multi-region MongoDB Atlas cluster, in its own database. AWS for S3, SES and the small worker, defined with CDK. One Docker image for hosted and self-host. Free to use. MCP is the only public integration surface; the REST API is documented for self-hosters but not promised stable.

**Done means.** A save from Safari on iPhone, the Chrome popup, an email or an MCP tool call lands in the inbox within 300 ms, has the page text and a cover within 10 seconds, is searchable within 30 seconds, and shows up in the user's AI tool through the connector with full text available on request.

## Architecture

One Next.js image serves the web app, the marketing pages, the REST API and the MCP server. A second copy of the same image runs as a worker for retries, email-in, imports, exports, the nightly expiry job and the weekly digest. Page extraction runs inline on save with a hard 5-second cap, so a save is fast and a slow page falls back to the retry queue. Nothing calls a model.

**Why no AI in the app.** It keeps the hosted cost near zero, it removes the thing that goes wrong most often in this category (runaway auto-tags), and it makes the product work with any AI tool. The MCP tools are designed so a model can do everything the old pipeline did, but only when you ask it to, with you watching.

**Hosted vs self-host, same code.** Hosted runs on getpluck.io (Vercel to start, or one Fargate task), the shared Atlas cluster, S3 and SES. Self-host is `docker compose up` with `web`, `worker`, `mongod` and a local blob folder. The job queue is a Mongo collection with a `visibleAt` lease, so there is no SQS and no Redis anywhere.

**What stays out of the request path.** Email parsing, imports, exports, expiry and the digest. Extraction is the one thing that runs inline, because the user is waiting to see the title and cover, and it is capped at 5 seconds.

## Repo layout and licences

One monorepo (pnpm workspaces, Turborepo). Everything is Apache-2.0, with a DCO sign-off instead of a CLA.

```
apps/web          Next.js: app, marketing, /api/v1, /mcp
apps/worker       same image, worker entry
apps/extension    WXT
apps/ios          Expo app + Swift share extension
packages/shared-schemas   Zod types, OpenAPI, error codes
packages/db       the only package that touches MongoDB
packages/extract  Defuddle/Readability, fixtures
packages/mcp      tools, resources, prompts
packages/mcp-stdio  npx @getpluck/mcp bridge for self-host
packages/ui       brand tokens, Logo and Icon components, kind glyphs
infra/cdk         DataStack, EmailStack, DnsStack
docs/             self-host.md, mcp.md
```

**Rules.** Every type starts as a Zod schema in `shared-schemas`. Only `packages/db` touches MongoDB, enforced by an ESLint rule. Web and worker share one Dockerfile. Node 22, pnpm 10, TypeScript strict, ESM. No `packages/ai`, and a PR that adds a model call to the server is declined on principle.

## Data model

Pluck lives in its own database, `pluck`, on an existing MongoDB Atlas cluster, with its own database user scoped to that database only. Every document carries `userId`. Notes, todos and things are `items` with no URL, so there is one inbox and one search.

| Collection | Key fields | Purpose |
|---|---|---|
| `users` | `_id, email, name, handle, settings { digestDay, timezone, expiryDays (14, 30, 60, 90 or null), expiryScope ('inbox_later' or 'inbox') }, createdAt` | Account and preferences. `handle` is set only when the user first makes a list public. `expiryDays` defaults to 30, `expiryScope` to `inbox_later` |
| `items` | `_id, userId, kind, url, urlHash, canonicalUrl, title, titleIsDerived, siteName, author, excerpt, coverKey, status, archivedReason, dueAt, tagIds[], note, source, readingProgress, wordCount, lang, extraction { state, attempts, lastError }, createdAt, updatedAt, lastOpenedAt, lastTouchedAt` | The inbox reads this and nothing else. `lastTouchedAt` is the newest of created, opened, edited, tagged or listed, and drives expiry. `archivedReason` is `user`, `expired`, `bulk` or `import` |
| `contents` | `_id, itemId, userId, textMarkdown, htmlKey, pdfKey, transcript, extractor, bytes` | Reader view and full text for search and for the AI tool. For a Note, `textMarkdown` is the body the user typed and `extractor` is `user`. Never served on a public page |
| `tags` | `_id, userId, name, slug, colour, count, createdAt, createdBy` | Your vocabulary. `createdBy` is `user` or `mcp` |
| `lists` | `_id, userId, name, slug, purpose, visibility (private, public), itemCount, tickedCount, views, lastAddedAt, lastActivityAt, createdBy, createdAt, updatedAt` | An ordered, purposeful group. `slug` is unique per user. No smart lists, no unlisted |
| `listItems` | `_id, listId, userId, itemId, position, note, noteBy, ticked, tickedAt, addedBy, addedAt` | One row per item per list. The note and the tick belong to the list, not the item. `noteBy` is `user` or `mcp` |
| `highlights` | `_id, userId, itemId, quote, note, selector { textQuote, textPosition }, createdAt` | Highlights and notes on link items only |
| `imports` | `_id, userId, source, blobKey, total, done, failed, state` | Pocket, Omnivore, Raindrop, HTML |
| `emailAliases` | `_id, userId, token, active` | `pluck+<token>@in.getpluck.io` |
| `apiKeys` | `_id, userId, name, hash, prefix, scopes[], lastUsedAt` | Personal tokens |
| `reports` | `_id, listId, reporterIp, reason, createdAt, state` | Reports from the public page. Reviewed by hand |
| `jobs` | `_id, queue, payload, state, attempts, visibleAt, lastError` | The Mongo-backed queue |
| `auth_*` | Managed by Better Auth | users, sessions, accounts, oauthClient, oauthAccessToken |

**Gone on purpose.** No `chunks`, no `tagSuggestions`, no `clusters`, no `enrichment`. No `lists.kind` or `lists.query` (smart lists are cut). No `publicId` (unlisted is cut).

**Enums.** `kind`: link, video, pdf, image, note, todo, thing. `status`: inbox, later, archived, done. `source`: ios, extension, web, email, mcp, import, api, copied. `visibility`: private, public. `extraction.state`: pending, done, failed, none (notes). `archivedReason`: user, expired, bulk, import.

**Kind groups.** The UI's "Links" chip is `kind in [link, video, pdf, image]`. The API takes `kinds[]`, so the client expands the group. No server-side group enum.

**Notes.** `kind: note` with `url: null`. `title` is set by the user, or derived from the first non-empty line of `contents.textMarkdown` with `titleIsDerived: true`, recomputed on every body save until the user edits the title by hand. `PATCH /items/:id` with `{ text }` writes `contents.textMarkdown` for notes only.

**Indexes.** `items`: `{ userId, status, createdAt: -1 }`, `{ userId, status, lastTouchedAt: 1 }` (untouched-first sort and the expiry job), `{ userId, urlHash }` unique sparse, `{ userId, tagIds, createdAt: -1 }`, `{ userId, kind, dueAt }`, `{ 'extraction.state', updatedAt }`. `contents`: `{ itemId }` unique plus a `$text` index on `textMarkdown` and a denormalised `items.searchText` (title, excerpt, note, tag names, list names). `tags`: `{ userId, slug }` unique. `lists`: `{ userId, slug }` unique, `{ userId, updatedAt: -1 }`, `{ userId, lastActivityAt }`. `listItems`: `{ listId, position }`, `{ itemId }`, `{ userId, itemId, listId }` unique. `jobs`: `{ queue, state, visibleAt }`. If the cluster tier has Atlas Search, add one `$search` index over `items.searchText` and `contents.textMarkdown` with `userId` as a filter field, and keep `$text` as the fallback.

**Public reads.** A public list page reads `lists` by `(handle, slug)`, then `listItems` in position order, then the matching `items` projected to `title, siteName, excerpt, coverKey, url` plus the `listItems.note`. It never touches `contents`, `tags`, `ticked` or `status`. The projection is a single function in `packages/db/public.ts` with a test that asserts the field list. Ordering is a `position` float with periodic renumbering, which makes drag reorder one write.

**Blobs.** `u/<userId>/items/<itemId>/raw.html`, `/cover.jpg`, `/file.pdf`, and `u/<userId>/exports/<date>.zip`. Lifecycle to Infrequent Access at 90 days. Never GridFS, never content embedded in `items`.

## API

One versioned REST API at `/api/v1` serves every first-party client, and the MCP server is a thin layer over it. Bodies and responses are Zod-validated from `shared-schemas`, and the OpenAPI document is generated from the same schemas. MCP is the only integration surface we promise to keep stable.

| Method and path | What it does | Notes |
|---|---|---|
| `POST /items` | Save one URL, many URLs, a note, a todo or a thing | Body is one of `{ url }`, `{ urls[] }` (max 50, returns one result per URL, each idempotent on `urlHash`), or `{ text, kind }`. For `text` with no `kind`, the server extracts URLs from it: one or more found means one link item each, none means a Note. Accepts optional `html`, `selection`, `transcript`, `title`, `note`, `tagIds`, `listId`, `dueAt`. Extracts inline with a 5 s cap |
| `GET /items` | List and filter | `status, kinds[], tagId, listId, since, q, sort (newest, untouched), cursor, limit (max 50)` |
| `GET /items/:id` | Item plus optional content | `include=text,highlights,lists` |
| `PATCH /items/:id` | Status, kind, tags, due date, note, progress, title, text (notes only) | Unknown tag ids return 422 with the nearest existing tags. `archivedReason: user` when status becomes archived |
| `POST /items/batch` | Apply one change to many items | For the AI tool and for bulk select. Max 100 |
| `POST /items/archive-stale` | "Archive it all": move Inbox (and Later per scope) items untouched for longer than `olderThanDays` to Archive | Items in any list are skipped. `dryRun: true` returns the count for the confirm step. Sets `archivedReason: bulk` |
| `DELETE /items/:id` | Soft delete, 30-day bin | Web and iOS only, never MCP |
| `POST /items/:id/reextract` | Re-run extraction | |
| `GET /search` | Text search with filters | `q, kinds[], tagIds[], listId, status, since, until, limit` |
| `GET /tags`, `POST`, `PATCH /:id`, `DELETE /:id` | Vocabulary | Delete requires `reassignTo` or `removeFromItems` |
| `POST /tags/purge-ai` | Remove every tag assignment made by MCP in the last N days | The "Remove everything AI tagged this week" button. Tags with zero remaining items and `createdBy: mcp` are deleted |
| `GET /lists`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | Lists | `PATCH` covers name, purpose, visibility. Making a list public requires a handle, else 409 `handle_required` |
| `POST /lists/:id/items`, `DELETE /lists/:id/items/:itemId` | Add or remove an item from a list | Add accepts `position`, `note`. Adding touches `items.lastTouchedAt` and `lists.lastActivityAt` |
| `PATCH /lists/:id/items/:itemId` | Per-list note, tick, position | Position is a float between neighbours |
| `POST /lists/:id/reorder` | Full order in one call | `itemIds[]`, used by drag and by the AI tool |
| `GET /lists/:id/export` | One list as JSON plus Markdown | |
| `GET /p/:handle/:slug` | Public list page data | No auth. Cached 60 s at the edge. The narrow projection only. Increments `views` on the server, not from the client |
| `POST /lists/copy` | "Pluck this list": copy a public list into the caller's account | Creates items with `source: copied` and a new private list. Rate limited to 20 a day |
| `POST /reports` | Report a public list | No auth. `listId, reason`. Rate limited per IP. Writes `reports` |
| `GET /digest` | Rule-based resurfacing | Items within 7 days of expiry and not in any list, items due, oldest inbox, lists idle 30 days |
| `POST /highlights`, `PATCH`, `DELETE` | Highlights and notes | |
| `POST /imports`, `GET /imports/:id` | Import files | Pocket CSV, Omnivore zip, Raindrop CSV, Netscape HTML. Imported items get `archivedReason: import` |
| `GET /export` | Full export | Starts a job, emails a signed link when done |
| `GET /me`, `PATCH /me` | Profile, settings (`expiryDays`, `expiryScope`, `digestDay`, `timezone`), handle | Handle is 3 to 24 chars, lowercase, unique, changeable once a month |
| `GET /api-keys`, `POST`, `DELETE` | Personal tokens | Shown once |

**Multi-link paste.** URL extraction from text is a shared function in `shared-schemas/urls.ts`: finds `http(s)://` and bare `www.` hosts, strips trailing punctuation, dedupes, max 50. Used by the web paste box, the share extension (text shared from X and YouTube), email-in and MCP `save_item`.

**Auth on every request.** `Authorization: Bearer <token>`: a session token, an OAuth access token (extension, iOS, MCP clients) or a personal API key (`pk_live_...`). Middleware resolves `{ userId, scopes }` and the repository layer scopes every query.

**Error shape.** `{ error: { code, message, details? } }` with a closed set of codes in `shared-schemas/errors.ts`.

**Rate limits.** Per user: 120 writes and 600 reads a minute. Per IP on `/items`, `/mcp`, `/lists/copy` and `/reports`: 300 a minute. `429` with `Retry-After`.

**Pagination.** Opaque cursors, never offsets.

## Auth

Better Auth inside the Next.js app, storing in the `pluck` database, handles login, sessions, API keys and acts as the OAuth 2.1 server the extension, the iOS app and MCP clients sign in through. One system, self-hostable.

**Packages.** `better-auth`, the MongoDB adapter, `@better-auth/oauth-provider`, `@better-auth/mcp`, `@better-auth/cimd`, the `apiKey` plugin.

**Login.** Email magic link and GitHub. No passwords.

| Client | Flow | Token storage | Scopes |
|---|---|---|---|
| Web app | Session cookie, httpOnly, SameSite=Lax | Cookie | full |
| Extension | Authorisation code plus PKCE via `chrome.identity.launchWebAuthFlow` | `chrome.storage.local` | `library:read library:write library:delete` (Undo and Delete, to the bin) |
| iOS app and share extension | Authorisation code plus PKCE via `ASWebAuthenticationSession`. The share extension reads the token from a shared Keychain group and never shows login | Keychain access group | same |
| MCP clients (Claude, ChatGPT, Cursor, others) | OAuth 2.1 with CIMD, fallback DCR, PKCE S256, resource indicator | Held by the client's provider | `library:read library:write`, optional `library:delete` |
| Claude Code, scripts, local MCP | Personal API key as a bearer token | User's machine | per key |

**Consent screen.** `/oauth/consent` with the Pluck mark, the scopes in plain words ("read your saves", "save and organise"), Allow and Deny. It is the only Pluck screen most connector users ever see, so it carries the voice.

**Lifetimes.** Access tokens 1 hour, refresh 90 days rotating, sessions 30 days sliding. API keys never expire but revoke in one click and show `lastUsedAt`.

**Hard rules.** Validate `aud` on every OAuth token. Hash API keys with SHA-256, store the hash and a 6-character prefix. Never log bearer tokens. Account deletion is self-serve and wipes items, contents, blobs and auth rows within 24 hours; backups purge within 30 days.

## Content capture

Pluck keeps the page, not just the link. That is the one "clever" thing the backend does, and it needs no model.

**Where it runs.** Inline in `POST /items`, capped at 5 seconds. Client-supplied HTML (from the extension or the Safari share pre-processor) wins and takes under 100 ms to clean. Otherwise the server fetches with a browser user agent and runs Defuddle, falling back to Mozilla Readability. If that fails or times out, the item is saved with the URL and whatever title the client sent, `extraction.state` is set to `pending`, and a job is queued for the worker to retry three times with backoff. Failed items show Retry, Open original and "Try the Wayback copy", a client-side link to `https://web.archive.org/web/*/<url>`. No server call.

| Kind | How the content is captured |
|---|---|
| Article | Client DOM, else fetch plus Defuddle. Raw HTML to S3, Markdown to `contents` |
| YouTube | oEmbed title, thumbnail and description. The extension captures the transcript from the page in the user's own session, because YouTube blocks transcript fetches from cloud IPs |
| X post or thread | The extension captures the rendered DOM. Server-side, public oEmbed for a single post |
| PDF | Upload or URL, text via unpdf, file to S3 |
| Image | Stored to S3, no text |
| Newsletter | SES receives at `pluck+<token>@in.getpluck.io`, raw email to S3, the worker parses HTML to Markdown |
| Note, todo, thing | Text only, no URL, no extraction. `extraction.state: none` |

**Covers.** `og:image` if present, else the extension's `captureVisibleTab` screenshot, else no cover and the card shows the site initials.

**No headless Chrome in v1.** Bot walls and paywalls are handled by the extension sending what the user's browser rendered. If a page fails from the server, the honest answer is "save it from the extension" or the Wayback link. A Playwright worker is a v1.1 option behind a flag.

**Tests.** 30 saved HTML fixtures (news, docs, YouTube, X, a paywall, a PDF link, a newsletter) with expected titles and word counts, plus 20 multi-link paste fixtures, run on every PR.

## Expiry, archive and the digest

Three worker jobs, all plain rules.

**Nightly expiry (02:00 user local, batched by timezone).** For each user with `expiryDays` set: items where `status in scope` (`inbox` and `later`, or `inbox` only), `lastTouchedAt < now - expiryDays`, and no row in `listItems`, get `status: archived, archivedReason: expired`. Never deletes. Logs count per user. Idempotent.

**Expiry warning.** `GET /digest` and the Monday email list items that will expire within 7 days. The "30 days" pill in Later uses the same rule client-side from `lastTouchedAt` and the user's `expiryDays`.

**Archive it all.** `POST /items/archive-stale { olderThanDays, dryRun }`. The UI calls `dryRun` first to show the count in the confirm ("112 items"), then commits. Lists are skipped. `archivedReason: bulk` so the Archive's "expired" filter can show `expired` and `bulk` together.

**Monday digest (06:00 user local).** Sections: expiring within 7 days (not in a list), due this week, five oldest inbox, lists idle 30 days, and an "Archive it all" signed link that opens the confirm in the web app. Signed one-tap links, 7-day expiry, no login. Plain text version first-class.

**Copy rule.** Every message about expiry says "to the Archive" and "nothing is deleted".

## Search

Text search over titles, notes, tags, list names and the page body, filtered by `userId`. No vectors, no "by meaning". If you want meaning, you ask your AI, which can read the full text of any item through MCP.

**Default.** A MongoDB `$text` index on `items.searchText` (title, excerpt, note, tag names, list names, site) and `contents.textMarkdown`, weighted 10 for title, 5 for note and tags, 1 for body. Exact URL matches pin to the top. Results carry the best snippet.

**If the shared cluster has Atlas Search.** One `$search` index with `userId` as a filter field replaces `$text` behind `SEARCH_BACKEND=atlas`. Same API, better ranking and fuzzy matching.

**Filters.** `kinds[]`, `tagIds[]`, `listId`, `status`, `since`, `until`.

**Sort.** `newest` (default) or `untouched` (`lastTouchedAt` ascending). No read/unread filter, by design.

**Budget.** 5,000 items, results in under 300 ms on `$text`. Measure with a seeded test user on every deploy.

## MCP server

The MCP server is the product's brain socket and the only public integration surface. It is mounted at `/mcp` inside the Next.js app with the official TypeScript SDK v2 (MCP spec 2026-07-28, streamable HTTP, stateless). Twelve tools, two resources, four prompts. Any MCP client connects to the same endpoint.

**How each client connects.**

| Client | Setup | Auth |
|---|---|---|
| Claude (web, desktop, mobile) | Settings, Connectors, Add custom connector, paste `https://getpluck.io/mcp` | OAuth 2.1, CIMD with DCR fallback, PKCE S256 |
| Claude Code | `claude mcp add --transport http pluck https://getpluck.io/mcp` | OAuth with loopback redirect, or `--header "Authorization: Bearer pk_live_..."` |
| ChatGPT | Settings, Connectors, Create, MCP server URL | OAuth |
| Cursor and other editors | `mcp.json` with `{ "mcpServers": { "pluck": { "url": "https://getpluck.io/mcp" } } }` | OAuth or API key |
| Self-host without public HTTPS | `npx @getpluck/mcp --server <url> --key pk_live_...` (stdio bridge) | API key |

**OAuth flow.** `POST /mcp` without a token returns `401` with `WWW-Authenticate: Bearer resource_metadata="https://getpluck.io/.well-known/oauth-protected-resource"`. The client reads the first `authorization_servers` entry, fetches `/.well-known/oauth-authorization-server`, uses CIMD if advertised and DCR otherwise, runs the authorisation code flow with PKCE and `resource=https://getpluck.io/mcp`, and refreshes on its own. The server validates `aud` on every request and includes `iss` in authorisation responses. Each discovery and token endpoint answers inside 10 seconds. No apex-to-www redirects on these paths.

**Tools (12).**

| Tool | Purpose | Arguments and limits |
|---|---|---|
| `search_items` | Text search, returns compact cards | `query, kinds[], tagIds[], listId, status, since, limit (max 25), cursor` |
| `list_items` | Browse by status without a query | `status (inbox, later, archived, done), kinds[], sort (newest, untouched), limit (max 25), cursor` |
| `get_item` | One item with full text, highlights, note and the lists it is in | `id, include[]`. Text paged at 20k tokens with a cursor. This is how the AI reads |
| `save_item` | Save a URL, many URLs in a block of text, a note, a todo or a thing | `url or text, kind, title, note, tagIds[], listId, dueAt`. Idempotent. `source: mcp` |
| `batch_update` | One change over one or many items: status, kind, tags, due date, note | `itemIds[], patch`. Max 100. Unknown tag ids return the nearest existing tags, never auto-create |
| `list_tags` | Vocabulary with counts | None |
| `create_tag` | Make a new tag, only after the user said yes | `name`. Marked `createdBy: mcp` |
| `list_lists` | The user's lists with purpose, counts and visibility | `cursor` |
| `get_list` | One list in order with per-item notes and ticks | `id` |
| `create_list` | A list with a purpose and ordered items, each with an optional note | `name, purpose, items[{ itemId, note }]`. Always private. Marked `createdBy: mcp`, notes `noteBy: mcp` |
| `update_list` | Name, order, add or remove items, per-item note or tick, visibility | `id, patch`. Purpose is read-only to MCP. Visibility to `public` is only accepted when the user said so in the same conversation, and the server still requires a handle |
| `get_digest` | Rule-based resurfacing | `since, limit`. Expiring, due, oldest inbox, idle lists |

`delete_item` exists behind the `library:delete` scope, which the consent screen does not request by default.

**Resources.** `item://{id}` (markdown of one item) and `list://{id}` (the list in order with notes), so a person can attach a whole project's sources to a chat without a tool call.

**Prompts (4).**

| Prompt | What it does |
|---|---|
| `tidy_inbox` | Reads the inbox with `list_items`, calls `list_tags`, proposes a tag or two per item from the existing vocabulary and a keep, later or archive decision, asks for a yes, then applies with `batch_update`. New tags only via `create_tag` after an explicit yes |
| `build_list` | Takes a topic or a time window, searches and reads, proposes one or more lists with items in order and a line on each, creates them private with `create_list`. Also the "group what I plucked this month" job |
| `content_ideas` | Takes a topic and a time window, reads the strongest items with `get_item`, drafts three angles with sources in the user's voice, offers to make a list of the sources and to `save_item` the draft as a Note |
| `weekly_review` | Walks `get_digest`: expiring, due, oldest inbox, idle lists. One decision at a time |

**Response discipline.** Opaque cursors everywhere. Responses capped at about 8k tokens. Cards carry `id, title, kind, siteName, excerpt, tags, savedAt, url` and nothing else. Tool descriptions are one sentence and never name a vendor. Do not build on Roots, Sampling or Logging, which the 2026-07-28 spec deprecates.

**Testing.** An end-to-end test runs the full OAuth dance against staging with a fake CIMD client, then calls each tool and each prompt, on every deploy. This is the feature people will judge Pluck on.

## Browser extension

WXT, Manifest V3, React popup, one codebase for Chrome, Firefox and Safari. Its job: one click saves the page and keeps what your browser rendered.

**Capture.** On save the content script runs Defuddle on the live DOM and posts `{ url, title, html, selection, byline, coverUrl, transcript? }`. SPAs are captured at click time. On YouTube it reads the transcript from the player data in your session. No `og:image` means a `captureVisibleTab` screenshot. Bulk bookmark import parses the HTML in an offscreen document.

**Popup.** Opening it saves the tab at once and shows "Plucked" in under 300 ms with the title and an Undo link. Below: a tag picker over your own tags, a kind row (seven kinds), a "to list" picker that remembers the last list used (`chrome.storage.local`), a note field. Buttons: Later, Archive, Open in Pluck. Footer: "Pluck all N tabs into a new list, '<date> tabs'", which calls `POST /lists` then `POST /items` with `urls[]` and `listId`. If the URL is already saved, the popup opens on that item instead. Max height 460 px.

**Other surfaces.** Context menus for link, selection (as highlight), image and page. Commands `Alt+Shift+P` save, `Alt+Shift+H` highlight. Badge tick when the current page is already in the library, dot when a save is queued.

**Service worker.** Can be killed after 30 seconds idle, so no in-memory state. `chrome.storage.session` for transient state, `chrome.storage.local` for tokens, the tag cache and the last list, `chrome.alarms` for retries.

**Auth.** `chrome.identity.launchWebAuthFlow` with PKCE against the Better Auth OAuth server. Self-hosters paste a server URL and an API key in Options.

**Permissions.** `activeTab, contextMenus, storage, scripting, identity, alarms`, host permission for the API origin, `<all_urls>` requested at runtime on first need.

**Builds.** `wxt build -b chrome|firefox|safari`. The Safari build wraps with `xcrun safari-web-extension-converter` and ships inside the iOS bundle later. Store listings need the privacy policy URL (`/privacy`) and a 30-second video.

## iOS app and share extension

An Expo main app plus a hand-written Swift share extension. The share extension is the front door, saves in place without opening the app, must open in under 300 ms and never crash, so it stays native and small.

| Part | Decision |
|---|---|
| Target | Share Extension (top app row of the share sheet, where Pocket lived), not Action Extension |
| Activation rule | SUBQUERY accepting `public.url`, `public.plain-text`, `public.image` (max 10), `com.adobe.pdf` (max 1). Never `TRUEPREDICATE` |
| Safari pre-processing | `NSExtensionJavaScriptPreprocessingFile` returns title, selection, `og:image` and `outerHTML`, so paywalled and logged-in pages are kept |
| Item handling | `UTType.url` first, then `plainText` (run the shared URL extractor: many URLs means `urls[]`, none means a Note), then image and PDF file URLs copied into the App Group with `FileManager.copyItem`, never loaded into memory |
| Upload | URL saves: `POST /items` with a 5 s timeout. Files: background `URLSession` with `sharedContainerIdentifier`. On failure, a pending record in the App Group drained by the main app |
| Auth | Tokens in a Keychain access group shared with the app. No login UI in the extension. Signed out shows one line and a button that opens the app |
| UI | SwiftUI sheet: "Plucked" tick, title, two tag chips from a cached vocabulary plus "Add to <last list>", a kind row, an optional one-line note field, Done. Auto-dismisses after 2 seconds unless the note field is focused. Under 30 MB resident |
| Wiring | An Expo config plugin adds the target, App Group, Keychain sharing and entitlements so `expo prebuild` is reproducible |

**Main app.** Expo SDK 55, Expo Router. Inbox, Later, Search, Lists, Settings. Note editor with native text input. Offline: a persisted TanStack Query cache and a SQLite save queue. The reader renders `textMarkdown` natively with highlight support. Auth via `ASWebAuthenticationSession` with PKCE. Settings carries a "Put Pluck first in Share" tip, because the share row order is the single biggest driver of share-sheet use.

**Stopgap.** An iOS Shortcut named "Pluck" in the share sheet that posts the URL with an API key. No review needed, works on day one, and is the fallback if the app is rejected.

**App Store.** Default sign-in points at getpluck.io, "Use your own server" behind Advanced, a permanent demo account for review, in-app account deletion and the privacy policy URL. Expect one Guideline 2.1 rejection.

## Marketing site, privacy and terms

Served by the same Next.js app at `/`, `/connect`, `/open-source`, `/privacy`, `/terms`, statically generated. Same brand package as the app (`packages/ui`). The home page paste box is live: a visitor's paste creates an anonymous pending item held for 24 hours and claimed at sign-up.

**Privacy page** states what is stored, that no person reads the library and no model is called by the app, that a connected AI tool reads on the user's behalf under its own terms, what a public list exposes, email-in handling, one session cookie and no third-party analytics, hosting region, export and delete, and the Irish DPC route.

**Terms page** states age 16+, the library belongs to the user, public list rules (no illegal content, nothing that sexualises minors, no harassment, doxxing, spam, malware or infringement), takedown and account closure for repeat abuse, stored pages as a private cache with rights-holder removal on request, fair use and rate limits, 90 days' notice and working export if the hosted service ever ends, and Irish law.

**Report flow.** Every public page has a Report link that posts to `POST /reports`. Reports land in a private admin list and in an email to `[ABUSE EMAIL]`. A per-list kill switch and a per-user kill switch exist in an admin route behind an allowlist.

**Placeholders to fill before launch.** Legal entity, address, privacy and abuse emails, hosting provider and region, licence, repo URL, takedown response time.

## Infrastructure and costs

Pluck piggybacks on what already exists. The database is an existing multi-region Atlas cluster, already backed up and paid for. The rest is S3, SES and one small compute slot.

**Hosted (getpluck.io).**

| Piece | Choice | Why |
|---|---|---|
| Compute | Vercel Hobby or Pro for the Next.js app to start, with the worker as a Vercel cron plus a `/api/worker/tick` route. Move to one Fargate task later if MCP long requests or egress cost bite | Zero ops, zero floor cost |
| Database | An existing Atlas cluster, `pluck` database, dedicated user scoped to that database | Multi-region, backups and monitoring already paid for |
| Blobs | One S3 bucket `pluck-content` in eu-west-1, lifecycle to IA at 90 days | Pennies |
| Email | SES: domain identity for `in.getpluck.io`, MX record, receipt rule to S3, and outbound for the digest, magic links and report alerts | Pennies |
| DNS and certs | Route53 for the domain, Vercel handles certs for the app, ACM for SES | |
| Secrets | Vercel env vars for the app, Secrets Manager for anything a CDK stack needs | |

**CDK stacks (3).** `DataStack` (S3 bucket, lifecycle, IAM user for the app), `EmailStack` (SES identities, receipt rule, MX), `DnsStack` (Route53 records). No VPC, no queues, no Lambdas in v1.

**Self-host.** `docker compose up` with `web`, `worker`, `mongod` (8.2, single-node replica set) and a local blob volume. Minimum spec 1 vCPU, 1 GB RAM. Optional `minio` profile. `SEARCH_BACKEND=text` is the default and needs nothing extra.

**Monthly cost at list prices.**

| Line | Just Niall | 1,000 users |
|---|---|---|
| Compute (Vercel) | $0 to $20 | $20 to $40 |
| Atlas | $0 (shared) | $0 to $20 extra storage |
| S3 and egress | $1 | $15 |
| SES | $0 | $5 |
| Route53 and domain | $1 | $1 |
| Total | about $2 to $22 | about $40 to $80 |

The cost that matters is the one that is not there: no model calls, no vector store, no queue service, no NAT gateway. That is what makes "free forever" credible.

**Guardrails on the shared cluster.** The `pluck` database user has `readWrite` on `pluck` only. A budget alarm on Atlas storage growth. Connection pool capped at 10 per instance. A nightly job that reports Pluck's share of the cluster.

## Engineering and design conventions

Ship small, test the capture and the MCP, and let Claude Code do the typing with impeccable keeping the design honest.

**Brand package.** `packages/ui` exports the design tokens (the eight light and six dark colours from the Product Spec), the Logo and Icon components (ported from the canvas `Logo.dc.html` and `Icon.dc.html`), the seven kind glyphs and the Fredoka, Geist and Source Serif font loading. The web app, extension popup and marketing pages import from it. iOS re-implements the tokens in Swift and uses the SVGs as assets.

**Impeccable in the repo.** Install once with `npx impeccable install` from the repo root. Run `/impeccable init` on day one so `PRODUCT.md` records the audience, purpose, voice and constraints, and `/impeccable document` after the first screens so `DESIGN.md` records the visual system. CI runs `npx impeccable detect --github apps/web/src` so the AI-slop tells fail the build.

**Branches and PRs.** `main` is deployable. Short branches, squash merges, a PR template with "what changed, how I tested it, a screenshot for UI". Claude Code opens PRs, a human merges.

**Types.** Zod first. `pnpm typecheck` must pass. No `any` without a `// why:` comment.

**Tests that matter.** Vitest on `packages/extract` (30 fixtures plus 20 URL-extraction fixtures), `packages/db` (every query `userId`-scoped, tested with two users; the public projection field list; the expiry job skips listed items), `packages/mcp` (each tool against a seeded database; `update_list` refuses `public` without the conversation flag; `batch_update` never creates tags), and the MCP OAuth end-to-end. Playwright smoke for save, multi-link paste, search, tag, archive, archive-it-all, note editing, list tick. No snapshot tests of components.

**CI.** GitHub Actions: lint, typecheck, unit, impeccable detect, build image, Playwright against a Compose stack, deploy preview on PR, production on tag.

**Observability.** Structured JSON logs with `userId, itemId, jobId, durationMs`. One metric on the dashboard: save-to-searchable, target p95 under 30 s. Vercel analytics off. No third-party analytics in the app at all.

**Feature flags.** A `flags` collection, cached 60 s. `emailIn`, `atlasSearch`, `chromeWorker`, `publicLists`.

**Dependencies.** Renovate weekly. Pin the MCP SDK, Better Auth and WXT to exact versions.

**Docs.** `docs/self-host.md` and `docs/mcp.md` are kept in the same PR as any env var or tool change. `docs/mcp.md` is the public install page's source.

## Build order for Claude Code

Each step ends green in CI and deployable.

1. Monorepo, `shared-schemas`, `db` with the `items`, `contents`, `tags`, `lists`, `listItems` collections and indexes, two-user scoping tests.
2. Better Auth: magic link, GitHub, sessions, API keys. Settings page with handle and API keys.
3. `POST /items` with inline extraction and the 30 fixtures. Multi-link paste. Web Inbox with rows, kind chips, sort toggle, keyboard triage. Note editor.
4. Lists: CRUD, per-list note and tick, reorder, `a` shortcut, list page, Private/Public switch, public page with the narrow projection and its test, copy, report.
5. Search with `$text`, filter chips, "Ask your AI" empty state.
6. Worker: retry queue, expiry job, archive-stale, digest email, email-in, import, export.
7. MCP server: OAuth metadata and CIMD, the 12 tools, 2 resources, 4 prompts, the end-to-end OAuth test. `npx @getpluck/mcp` bridge. Settings AI tools section.
8. Extension: popup, capture, list picker, all-tabs, context menus, badge, options.
9. Marketing site, privacy, terms, Connect your AI page.
10. iOS Shortcut, then the Expo app and the Swift share extension.
11. Docker Compose self-host path and `docs/self-host.md`.

## Risks and open decisions

| Risk | Likelihood | What we do |
|---|---|---|
| Scope creep back towards AI in the app | High | The rule is in `CLAUDE.md` and this doc: no model calls on the server. AI features are prompts in `packages/mcp` |
| MCP spec or client connector changes | High | Thin `packages/mcp`, pinned SDK, end-to-end OAuth test on every deploy, API-key fallback |
| Public lists leak stored page text | Medium, and the one that would hurt most | One projection function for public reads, with a test that pins the field list. `contents` is never joined on a public route |
| Public lists used for spam or link farms | Medium | Handles required, `noindex` on lists under 7 days old or from accounts under 7 days old, a report link on every public page, per-list and per-user kill switches, rate limits on list copies |
| Expiry archives something the user wanted | Low | Never deletes, lists are exempt, 7-day warning in the digest, Restore in one tap, "expired" filter in Archive |
| Multi-link paste creates junk from tracking URLs | Medium | Strip known tracking params before `urlHash`, cap 50 per paste, show the count before committing on web |
| Shared Mongo blast radius | Medium | Own database, own scoped user, pool cap, storage alarm, nightly share report. Move to a separate cluster if Pluck passes 10% of storage |
| Vercel limits on long MCP calls or egress | Low | The one-image Fargate path is a day's work and is in the Compose file already |
| Paywalls and bot walls on server fetch | High | Client-side capture is the default. Honest copy and the Wayback link when it fails |
| App Store rejection | Medium | Demo account, hosted default server, the Shortcut shipped first |
| Abuse of email-in and the save endpoint on a free product | Medium | Per-user tokens, rate limits, size caps, a kill switch per user |

**Open decisions.**

- Vercel vs one Fargate task for the hosted app (start on Vercel, revisit at 500 users)
- Does the cluster tier include Atlas Search? If yes, `SEARCH_BACKEND=atlas` from day one
- Expo SDK 55 vs 54
- Public list URL: `/@handle/slug` or `/l/<short-id>`
- Email-in domain: `in.getpluck.io`
