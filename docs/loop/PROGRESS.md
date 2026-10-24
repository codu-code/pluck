# Build loop

The plan agreed on 2026-10-24. Each run of the loop reads this file, works the **current slice**, and updates this file before it stops.

## How each iteration works

1. Read this file and `BLOCKED.md`. Pick the first slice that is not `done` and not `blocked`. Set it as current.
2. Build it as a vertical slice: Zod schema → `packages/db` (with a two-user test) → API route → UI copied from the matching board in `docs/handover/design/` → Playwright e2e.
3. Run the gate (below). Fix what fails. Record the last failing check under the slice.
4. When the gate passes, tick the slice, then `git add -A && git commit` as one squash commit on `main` (`slice N: <name>`). No remote, no push.
5. If a slice needs the human (a credential, a decision, loading the extension in Chrome): write it to `BLOCKED.md`, send a push notification, mark the slice `blocked`, move to the next slice.
6. Three failed attempts at the same check: write it to `BLOCKED.md` with the error, mark `blocked`, move on.
7. Stop the loop when every slice is `done` or the rest are `blocked`.

## The gate

All must pass before a slice is committed:

1. `pnpm typecheck && pnpm lint && pnpm test`
2. `pnpm e2e`: Playwright against `next build && next start` plus `docker-compose.dev.yml`. Every earlier slice's tests stay green.
3. `npx impeccable detect` on changed UI.
4. Chrome check through Claude in Chrome: run the slice's demo in the user's Chrome, screenshot it next to the matching `.dc.html` board (served over localhost), fix mismatches.
5. If infra changed: `cdk synth` plus template assertions in `infra/cdk` tests. Never deploy.
6. Architecture pass with the `mattpocock-skills:codebase-design` skill (the user asked for `improve-codebase-architecture`, which is not installed; this is the stand-in). Apply what is cheap now, record the rest under "Architecture notes".

## Local stack

`docker-compose.dev.yml`: `mongo:8` single-node replica set, Mailpit (1025 SMTP, 8025 UI and API), MinIO, and a static fixture server for extraction tests. Next.js runs on the host. Toolchain: Node 22, pnpm 10 via corepack (`packageManager` pinned), Docker running.

## Slices

| # | Status | Slice | Chrome demo |
|---|---|---|---|
| 0 | done | Walking skeleton: toolchain (Node 22, pnpm 10), pnpm and Turborepo monorepo, `docker-compose.dev.yml`, `packages/ui` (tokens, Logo, Icon, seven glyphs from `brand/`), `shared-schemas`, `db` skeleton with the ESLint rule, Next app, Vitest and Playwright wired, placeholder-listing test | Branded empty page |
| 1 | done | Magic-link sign-in (Better Auth, Mongo adapter), `sendEmail` seam (SES or SMTP), two-user scoping test harness, Empty inbox board. **CDK `EmailStack` outbound** | Link arrives in Mailpit, click it, land on the empty Inbox |
| 2 | todo | Pluck one URL: `POST /items`, inline extraction (Defuddle then Readability, 5 s cap), the 30 fixtures, cover to MinIO, re-pluck, the Mongo job queue and retry worker, `/api/worker/tick`, failed state with Retry, Open original and the Wayback link, `authenticate(request)`, the spec's per-user and per-IP rate limits (Mongo-backed, shared by every route). **CDK `DataStack`** with the app IAM user, granted `ses:SendEmail` on the `EmailStack` identity | Paste a URL, the row lands, the title and cover fill in |
| 3 | todo | Multi-link paste (`shared-schemas/urls.ts` and 20 fixtures), notes, todos and things, the note editor, kind chips | Paste a block of links and get N rows, then write a note |
| 4 | todo | Triage: Later, Archive, Done, the sort toggle, keyboard triage, bulk select, the delete bin, the reader with highlights, dark mode, PWA shell | Work through the inbox with only the keyboard |
| 5 | todo | Tags: CRUD, picker, 422 with the nearest tags, purge-ai | Tag items, then filter by tag |
| 6 | todo | Search: `$text`, `searchText` denormalisation, filters, "Ask your AI" empty state, 5k-item budget test | Search finds text in the page body |
| 7 | todo | Lists: create, add with `a`, tick, per-list note, reorder (float positions, Shift+J/K, drag), list export | Build an ordered list |
| 8 | todo | Public lists: handle, `/@handle/slug`, `public.ts` with its pinned-field test, copy, report, admin kill switches, `noindex` rules | Open the public page in a logged-out tab |
| 9 | todo | Expiry and archive: settings, the nightly job batched by timezone, archive-stale with a dry run, the expired filter, restore, "30 days" pill | Run the expiry job and items move to the Archive |
| 10 | todo | Monday digest: rule-based, HTML and plain text, signed one-tap links | Digest shows up in Mailpit and its links work |
| 11 | todo | Email-in: alias, `.eml` parsing in the worker. **CDK SES receipt rule to S3, record outputs** | Drop an `.eml` in and an item appears |
| 12 | todo | Settings: API keys, import (Pocket, Omnivore, Raindrop, HTML), export with a signed link, account delete | Import a Pocket CSV |
| 13 | todo | MCP: protected-resource and AS metadata, CIMD and DCR, consent screen, 12 tools, 2 resources, 4 prompts, OAuth e2e with a fake CIMD client, `npx @pluck/mcp` stdio bridge, Settings AI tools | Consent screen, then the MCP Inspector calls each tool |
| 14 | todo | Browser extension (WXT): popup, capture, tag and list pickers, all-tabs, context menus, badge, options, offline queue. Playwright loads the unpacked build. **Needs the human to load it unpacked in Chrome once** | Popup plucks the current tab |
| 15 | todo | Marketing site: home with the live paste box (anonymous item, claimed at sign-up), Connect your AI, Open source, Privacy, Terms | Paste as a visitor, sign up, the item is yours |
| 16 | todo | iOS: Expo app (inbox, lists, reader, search, settings, offline queue) and the Swift share extension via a config plugin. Gate: builds for the Simulator, unit tests pass, `simctl` screenshots match the boards, manual checklist written | Simulator screenshots, not Chrome |
| 17 | todo | Self-host: the Dockerfile (web and worker), `docker-compose.yml`, `docs/self-host.md`, `docs/mcp.md`, `docs/deploy.md` (Atlas user, `cdk deploy`, `vercel dns add` script, Vercel env and cron, SES out of the sandbox), `docs/launch-checklist.md` | `docker compose up` works from a clean clone |

## Environment (read every iteration)

- Node 22 is not first on PATH (Homebrew node@20 is). Prefix every shell command with `export PATH="$HOME/.nvm/versions/node/v22.23.4/bin:$PATH"`.
- The user runs **OrbStack**, not Docker Desktop. Export `DOCKER_CONTEXT=orbstack`. Never start Docker Desktop.
- Ports are offset so other projects keep theirs: Mongo 27027, e2e web 3300, dev or Chrome-check web 3000, design boards 4100. Other projects hold 27017, 1025, 8025, 9000 and 3100.
- Design boards: `python3 -m http.server 4100 --bind 127.0.0.1` from `docs/handover/design`. `support.js` there is our stand-in for the missing canvas runtime.
- `npx impeccable@4.7.0 detect http://127.0.0.1:3000/<route>` scans the running app (the file scan misses contrast rules).
- The user's Chrome is in dark mode, so Chrome checks show dark first. Check light with `document.documentElement.dataset.theme = "light"`.

## Architecture notes

Seams agreed so far, in the codebase-design vocabulary:

- **`packages/db` is the deep module for data.** Interface: userId-scoped functions per aggregate. Mongo is local-substitutable (the real `mongo:8` in Compose), so no repository port and no in-memory fake. Tests hit the real database.
- **One library module behind REST and MCP.** Route handlers and MCP tools both call the same in-process functions (in `apps/web/lib` or a package once it grows). MCP does not call the REST API over HTTP. This is how "MCP is a thin layer over the API" is honoured without a self-HTTP hop.
- **One `authenticate(request) → { userId, scopes }`** used by every route and by `/mcp`.
- **Email has a real seam:** two adapters (SES, SMTP to Mailpit) behind `sendEmail`.
- **Blobs have no seam:** the S3 SDK against MinIO locally and S3 in prod. One implementation.
- **Extraction:** `extract({ url, html? })` returns a result and does no writes. Tested against the fixture server.

## Deploy notes (collect into docs/deploy.md in slice 17)

- Vercel env: `MONGODB_URI` (Atlas, `pluck` database, `readWrite` on `pluck` only), `BETTER_AUTH_URL=https://getpluck.io`, `BETTER_AUTH_SECRET` (32+ random bytes), `EMAIL_FROM`, `AWS_REGION=eu-west-1`, the app IAM user's keys. No `SMTP_URL` in prod.
- `cdk deploy PluckEmail`, then add its `Dns*` outputs to Vercel DNS. Request SES production access (out of the sandbox) before launch.

## Notes per slice

_Last failing check, decisions made while building, anything the next iteration needs._

- **1:** Better Auth collections: `users`, `auth_sessions`, `auth_accounts`, `auth_verifications`, `auth_rate_limits`. Pluck fields (settings, handle) go on `users` through `packages/db`. Vitest gives each test file its own `pluck_test_*` database (`vitest.setup.ts`); `@pluck/db/testing` has `twoUsers()`. Claude in Chrome blocks reading token URLs back, so the Chrome check opens the magic link with `location.href = ...` inside the Mailpit tab. Clicking inside a field can hit the password-manager icon; focus fields with JS instead. No sign-out yet (Settings, slice 12).
- **0:** Turborepo skipped (`pnpm -r` covers it until the build gets slow). Playwright starts `webServer` before `globalSetup`, so `pnpm stack` runs inside the webServer command. The Logo gained an `auto` tone (CSS variables) so it reads in dark mode. The handover's `CLAUDE.md` is renamed `CLAUDE.original.md` so it stops auto-loading over the edited root one.
