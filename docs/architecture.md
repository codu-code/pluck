# How Pluck fits together

A map for someone opening the repo for the first time: where things live, how a pluck travels, which rules live where, and, at the end, where the code could be deeper. The words (Item, Kind, Status, Touch, Re-pluck, Expiry) are the ones in [GLOSSARY.md](../GLOSSARY.md).

## The shape

```
 iPhone app ─┐    share extension (Swift)
 extension ──┼── REST /api/v1 ──┐
 web app ────┘   (cookie, OAuth  │
                  token or key)  ├─ apps/web/lib/library ── packages/db ── MongoDB
 your AI ────── MCP /mcp ────────┘   (the rules)           (the only Mongo code)
                 packages/mcp                 │
                                              ├─ packages/extract (read pages, PDFs, email)
 worker / cron tick ── apps/web/lib/jobs ─────┤
                                              └─ packages/blob (S3 or MinIO)
```

One Next.js app (`apps/web`) is the website, the signed-in app, the REST API for our own clients and the MCP connector. The same code runs as the worker. There is no AI on the server: AI features are MCP prompts that the person's own AI runs.

## Where things live

| Path | What it is |
|---|---|
| `apps/web/app` | Routes. `(site)` is the marketing site, `(app)` the signed-in app, `api/v1` the REST API, `mcp` the connector, `p/[handle]/[slug]` public Lists (served at `/@handle/slug`). |
| `apps/web/lib/api.ts` | `route()` and `publicRoute()`: auth, scope, rate limits, body parsing and the error shape for every REST route. Most route files are a few lines. |
| `apps/web/lib/library/*` | The library: the product rules over `packages/db` (URL normalisation, the hourly pluck budget, the Kind and text rules, unknown tags refused with the nearest ones, kicking extraction). REST routes and the connector both call it. |
| `apps/web/lib/connector.ts` | Binds `PluckLibrary` (the interface in `packages/mcp/src/library.ts`) to the library for one person, with every write marked as made by AI. |
| `apps/web/lib/library/keeping.ts`, `jobs.ts`, `job-runner.ts`, `schedule.ts`; `apps/web/worker.ts` | Keeping a page (now, later, from a file or an import, with its one retry policy), the job handlers and the loop that runs them, and the time-based work (expiry, the Monday email, emptying the bin, polling email-in). `worker.ts` loops over them for self-host; on Vercel the cron route does. |
| `apps/web/lib/auth.ts`, `signin-code.ts`, `signin-link.ts` | Better Auth: email magic link, the 6-digit code the iPhone app uses, and the OAuth provider for the extension, the iPhone app and AI tools. |
| `apps/web/lib/email.ts`, `emails.ts`, `digest-email.ts` | `sendEmail` (SMTP to Mailpit locally, SES in production) and the email templates. |
| `packages/db` | Every collection, index and query (`collections.ts` defines them all). Every query is scoped by `userId`; `public.ts` is the only reader for public Lists. |
| `packages/mcp` | The connector's tools, resources and prompts (package `@pluck/mcp-server`). It sees the library only through `PluckLibrary`. |
| `packages/mcp-stdio` | The `npx @getpluck/mcp` bridge (package [`@getpluck/mcp`](https://www.npmjs.com/package/@getpluck/mcp), the one published to npm): stdio to the hosted connector with an API key. |
| `packages/extract` | Guarded fetch (`fetch.ts`), page and PDF reading (`extract.ts`, Defuddle then Readability), email (`email.ts`) and imports. Its fixtures are served by `pnpm stack` so tests never touch the internet. |
| `packages/blob` | S3 through the AWS SDK; MinIO locally and for self-hosting. |
| `packages/shared-schemas` | Every type as a Zod schema, used by the server and every client. |
| `packages/client` | What the iPhone app and the extension share: `createClient` (bearer auth, errors mapped to `Unreachable`, `SignedOut` or `Refused` by `answer`), `createSession` (the token refresh, once across every context that shares a store, and sign-out), `register`, `createQueue` (the offline queue) and PKCE. The web's offline queue is `createQueue` too, over `localStorage`; the iPhone app drains the share extension's App Group files with `createDrain`, the same keep and drop rules. `createLibrary` is the library actions both the web and the iPhone app take (move, restore, edit, delete, Tags, in and out of Lists, mark, reorder, put back), each owning its route, its body and how its error reads; the web runs it over `sameOrigin` (the session cookie, `apps/web/lib/actions.ts`), the iPhone app over its bearer client (`apps/ios/lib/data.ts`, which also refetches what each action makes stale). |
| `packages/i18n` | The words, in ten languages, one catalog per surface. See [i18n.md](i18n.md). |
| `packages/ui` | Tokens, the logo, the icon and the Kind glyphs. |
| `apps/extension` | WXT. The popup, options and a background worker that drains the queue every minute. |
| `apps/ios` | Expo Router app, plus `targets/share`, the SwiftUI share extension. See [ios.md](ios.md). |
| `infra/cdk` | S3 and SES for getpluck.io only. Self-hosting does not need it. |
| `e2e` | Playwright, one spec per feature, against a production build. `design.spec.ts` saves pages for `pnpm design`. |

## How a pluck travels

**From the web, the extension or the iPhone app.** `POST /api/v1/items` goes through `route()` (`lib/api.ts`), then `pluckAny` (`lib/library/items.ts`), then `pluckLink` in `packages/db`, which upserts on the person and the URL's hash. A Re-pluck finds the existing Item, moves it to the Inbox, takes it out of the bin and touches it; it never makes a second Item. The page is then read inline with a 5-second cap (`keepNow` in `lib/library/keeping.ts`); covers and the kept HTML go to blob storage after the response. A block of many links makes the rows at once and queues an `extract` job for each (`keepLater`). A page gets four tries, counted on the Item: now, then 30 s, 2 min and 10 min after each failure; a 4xx is final at once.

**From your AI.** `app/mcp/route.ts` checks the OAuth token or API key, that the tool is still connected and the rate limits, then serves `createPluckServer` (`packages/mcp/src/server.ts`), which lists only the tools the token's scopes allow. Tools call `connectorFor(userId)`, which reaches the same library, with `by: "mcp"` so Tags, notes, Lists and saves show "by AI".

**From email.** SES writes the message to the bucket under `inbound/`; the schedule polls it and queues an `email-in` job, which becomes an Item through `ingestInbound` (`lib/library/email-in.ts`).

**Jobs.** The queue is the `jobs` collection (`packages/db/src/jobs.ts`: claim with a lease, retry, fail). The handlers are in `apps/web/lib/jobs.ts`; the loop that claims and retries them is `lib/job-runner.ts`. They run:

- locally: `pnpm --filter @pluck/web worker`;
- self-hosted: the `worker` service in `docker-compose.yml`, the same image as `web`;
- on getpluck.io: a Vercel cron calls `/api/worker/tick` every minute, and plucks also kick the queue after responding.

## Sign-in and tokens

- **Web:** an email with a magic link and a code; a Better Auth session cookie. Sessions have the scope "full".
- **Extension:** OAuth 2.1 with PKCE and dynamic registration, in a normal tab that ends on `/extension/connected`. Tokens and the queue live in `browser.storage.local`. A personal API key (`pk_live_…`) works instead.
- **iPhone:** the same OAuth request, but the person types a 6-digit code from the email and the server answers with the redirect over HTTPS (`lib/signin-code.ts`), so no URL scheme carries a code. Tokens are one Keychain item, shared with the share extension.
- **AI tools:** OAuth for the `/mcp` resource, with client ID metadata documents or dynamic registration, and scopes `library:read`, `library:write` and (never asked for by default) `library:delete`, which deleting an Item, a List, a Tag or a highlight needs. API keys work too, with read and write unless made with delete.

## Offline

- **iPhone:** the TanStack Query cache is persisted, plucks made offline queue on the phone, the share extension leaves what it could not send in the App Group for the app to send, and on Wi-Fi the text of the newest 300 Items is kept for reading.
- **Extension:** plucks queue in storage; an alarm drains them every minute and the toolbar badge shows a dot while they wait.
- **Web:** the service worker (`public/sw.js`) keeps the app shell and an offline page in your language; plucks made offline wait in `localStorage`.

## Rules worth knowing before you change anything

- Only `packages/db` imports `mongodb` (an ESLint rule enforces it). Every new query gets a test with two people in it.
- Expiry and "Archive it all" set the Status to Archived. Items in a List are never expired (the `inList` field). Nothing is deleted by expiry or by an AI tool.
- Types start as Zod schemas in `packages/shared-schemas`.
- The connector is the only public API; the REST API is for our own clients and may change.

## Where it could be deeper

These are the places where the code is shallower than it needs to be: a rule written in several places, an interface that leaks what is behind it, or a file that changes for several reasons. Each names the files, the problem, a proposed shape and a rough size (S: an afternoon, M: a day or two, L: several days). Finished ones are removed; a "Done so far" line says what is left of a half-done one. Each would be its own pull request.

### 1. One owner for an Item's shape and its Status changes (M)

- **Files:** `packages/db/src/items.ts` (pluckLink, createFileItem, createTextItem, the bin, extraction updates), `email-in.ts` (createEmailItem), `account.ts` (importLink), `lists.ts` (around `doneFollowsMark`), `expiry.ts` (`archive`).
- **Problem:** a whole new Item document (about 30 fields) is spelled out by hand in five places, and the Re-pluck update is copied between `items.ts` and `email-in.ts`. Status is written in about six places: `statusFields()` handles the archived reason, but ticking a Todo in a List and expiry write it inline. The Touch rule (`lastTouchedAt`) is applied in about twelve places, with an exception for reading progress. A new field or Status rule means editing five or six files. `items.ts` (453 lines) changes for four reasons: writes, extraction, the bin and listing.
- **Shape:** one small module (`item-doc.ts`) with `newItem(userId, fields, now)`, `replucked(now)`, `toStatus(status, reason, now)` and `touched(now)`, used by every writer. Then split `items.ts` along its four reasons. Tests cross the module's interface: one table test per Status transition (the changed time, the archived reason, the List tick), and Re-pluck for both a URL and an email.
- **Done so far:** `item-doc.ts` has `newItem`, `replucked`, `statusFields` and `misfit` (which changes fit an Item: text, Kind, Done); every writer above but expiry uses them, and an edit and a batch refuse on the same `misfit`. The UIs ask `isTask` in `shared-schemas`. Left: `touched`, expiry's Status write, and the split of `items.ts`.

### 2. Derived fields have no single owner (M)

- **Files:** `packages/db/src/collections.ts` (the `ItemDoc` comment), `tags.ts` (`syncTagNames`), `lists.ts` (`syncListNames`), `items.ts` (`recountAround`, `textForSearch`, `bodyForSearch` at about seven call sites), `account.ts` (`importLink` sets `tagNames` itself).
- **Problem:** `tagNames`, `listNames`, `inList`, `searchText` and `searchBody` are "kept in step by the writes that change them", so each writer has to know which helpers to call. `inList` carries a product rule (Items in a List never expire): a writer that forgets `syncListNames` breaks expiry without a failing test.
- **Shape:** one `afterItemsChanged(userId, itemIds)` that recomputes every derived field and count, called by writers instead of picking helpers. Test: an invariant test that runs each write and checks the stored fields equal a fresh recompute.

### 7. Row words: one set of rules, translated at the edge (S to M)

- **Files:** `packages/shared-schemas/src/format.ts` (`when`, `ago`, `dueLabel`, `rowSite`, `rowMeta`), `apps/web/components/useFormat.ts`, `apps/ios/lib/format.ts` (`rowText`), and an inline `ago` in `apps/web/app/p/[handle]/[slug]/page.tsx`.
- **Problem:** "5 min ago", "Due Friday" and the row's site and meta line are worked out in four places. The English versions in `shared-schemas` survive as a test oracle for the iPhone app, which makes them look used.
- **Shape:** `shared-schemas` returns a message key and its values instead of words (for example `span(iso, now)` gives `["minutes", 5]`), plus `dueSpan`, `metaOf(item)` and `siteOf(item)`. Each app turns those into words with its own translator. One table test in `shared-schemas` covers the branching; delete the English copies.

### 8. The connector's rules belong in the library (S to M)

- **Files:** `packages/mcp/src/server.ts` (`save_item`, `update_list`), `packages/mcp/src/shape.ts`, `apps/web/lib/connector.ts`, `apps/web/lib/library/tags.ts` (`tagIdsFor`).
- **Problem:** `save_item` checks tag ids itself (ids only, no nearest suggestions), while `batch_update` goes through `tagIdsFor` (names too, with the nearest Tags). One rule, two behaviours. `update_list` sequences rename, remove, add and reorder inside the tool, so the steps are not one unit. "Only the person makes a List public" is enforced in tool code while `connectorFor` still offers `setVisibility("public")`. Errors are plain `Error`s with a `code` added on.
- **Shape:** a library call `pluckInto(userId, body, { tagIds, listId, by })` that checks every reference through `tagIdsFor` and `readList` before making anything. Narrow the connector's `setVisibility` to `makePrivate`, so the rule lives at the adapter. Share one error type (`ApiError` or a `libraryError(code, message, details)`) between `apps/web` and `packages/mcp`. `connector.test.ts` stays as it is and gains "an unknown Tag makes no Item".
- **Done so far:** `save_item` reads tags through `tagIdsFor`, and the connector offers only `makePrivate`. Left: `pluckInto` as one call, `update_list`'s steps as one unit, and the shared error type.

### 9. The web's list screens: shared cursor, selection and row state (M)

- **Files:** `apps/web/components/ItemList.tsx` (441 lines), `apps/web/app/(app)/lists/[id]/ListView.tsx` (420), `apps/web/app/(app)/search/SearchView.tsx`.
- **Problem:** each mixes data, state and view. The j/k cursor (with its "not while typing" guard and scrolling) is written three times, selection twice. ItemList's row logic (draft rows replaced when the pluck lands, the poll that fills in titles, moves with rollback) is pure but buried in the component, so it is only tested through Playwright.
- **Shape:** `useRowCursor(count, { onOpen, keys })` and `useSelection()` (three callers, so they pass the deletion test), and a pure `inboxRows(state, event)` reducer in `apps/web/lib`, tested in Vitest without a browser.

### Smaller ones

- **The expiry window is worked out twice** (`packages/db/src/expiry.ts` and `digest.ts`): export one `expiringFilter(userId, settings, now, withinDays)` from `expiry.ts` and use it in the digest, with a test that the Monday email and Later's "expiring soon" agree. S.
- **The edge envelope is copied** (`apps/web/lib/api.ts` repeats its catch block in `route` and `publicRoute`; `app/mcp/route.ts` re-implements API-key and OAuth checks and rate limits): one `authenticate(req, { audience })` and one `errorBody(e)` used by both. S; do it after the larger items.
- **The `"pluck:counts"` event name** is a constant in `RailNav.tsx` but a string literal in `TopBar.tsx` and `lib/actions.ts`. S.

### Already deep: leave these alone

- `apps/web/lib/library` is a real module, not a pass-through: delete it and URL normalisation, the hourly budget, the Kind rules and the 422 with the nearest Tags reappear in some 55 routes, the connector and the jobs. A dozen of its exports are bare renames; they give one import surface and cost little.
- REST and MCP already share the library through `PluckLibrary`, a real seam with two users (production and `connector.test.ts`).
- `route()` in `lib/api.ts`, `packages/db/src/public.ts`, `packages/blob`, `sendEmail` and the web `Picker.tsx` (one generic picker, two thin adapters).
