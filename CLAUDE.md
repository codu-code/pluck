# CLAUDE.md — Pluck

Pluck is a fast, open-source URL saver with an MCP connector. There is no AI inside the app. Read `docs/architecture.md` before any non-trivial change; `docs/handover/pluck-technical-spec-v2.md` has the background. Use the words in `GLOSSARY.md`. `docs/history/` is the record of the first build, not current.

## Non-negotiables

- **No model calls on the server.** No LLM SDKs, no embeddings, no vector stores, no "smart" anything. AI features are MCP prompts in `packages/mcp` that a connected client runs. A PR that adds a model call is declined.
- **Only `packages/db` touches MongoDB.** Every query is scoped by `userId`. Every new query gets a two-user test.
- **Public reads use one projection.** `packages/db/public.ts` is the only function that serves public list data. It never joins `contents`, `tags`, `ticked` or `status`. Its field list is pinned by a test.
- **Nothing is deleted by expiry or by MCP.** Expiry and "Archive it all" set `status: archived`. MCP has no delete tool outside the `library:delete` scope, which the consent screen does not request.
- **Every type starts as a Zod schema** in `packages/shared-schemas`; the API parses requests with it.
- **MCP is the only public API.** The REST API serves our clients and the MCP layer. Do not add other integrations.

## Product words

Every user-facing string lives in `packages/i18n` (see `docs/i18n.md`); other languages follow the glossary in `docs/i18n/`.

Use these and no others in UI copy: Pluck (verb), Plucked (confirmation), Item, Kind (Read, Watch, PDF, Image, Note, Todo, Thing), Status (Inbox, Later, Archived, Done), Tag, List. Never "saved", "bookmarked", "collection", "smart", "AI-powered", "magic". Say "your AI" or "AI tools", never one vendor as the only option. Expiry copy always says "to the Archive" and "nothing is deleted". No exclamation marks, no emoji.

## Stack

Next.js 16 App Router, TypeScript strict, Node 22, pnpm 10, ESM. MongoDB (`pluck` database; Atlas in prod, `mongo:8` single-node replica set locally). Better Auth with **email sign-in only** (a magic link on the web, a 6-digit code on the iPhone; App Review's account signs in with a password set in env; social logins later) and its OAuth provider for the extension, iOS and MCP. WXT for the extension. Expo (current SDK) plus a Swift share extension for iOS. One Docker image for web and worker. Search is `$text` only (no Atlas Search branch in v1).

## Decisions that differ from the spec

- **Hosting:** Vercel Pro for the app, the worker cron, the domain and DNS. No Route53, no `DnsStack`, no ACM.
- **CDK (`infra/cdk`):** `DataStack` (S3 `pluck-content`, eu-west-1, IA at 90 days, IAM user) and `EmailStack` (SES outbound identity, DKIM, MAIL FROM, inbound receipt rule to S3). The stack outputs the DNS records; `docs/deploy.md` adds them to Vercel DNS with `vercel dns add`.
- **Blobs:** S3 SDK is the only blob code. MinIO stands in locally and for self-host.
- **Email:** one `sendEmail` seam: SES in prod, SMTP to Mailpit locally. Email-in is tested with `.eml` fixtures dropped into blob storage.
- **Re-pluck:** saving a URL already in the library never makes a second item. It moves the existing item to Inbox and touches it, restoring it from the bin if needed.
- **Spec open questions:** Geist and Source Serif; digest Monday 06:00 by default, user picks the day; public URL `/@handle/slug`; no copy count on public pages; "Thing" stays; expiry scope defaults to Inbox and Later; email-in at `in.getpluck.io`.

## Design

`packages/ui` holds the tokens, the Logo and Icon components and the seven kind glyphs. Copy values from the `.dc.html` boards in `docs/handover/design/`, never round them. Banned: one-sided accent borders, cards in cards, gradients, glows, Inter, pure black, bounce easing, emoji, dashboards, cream grounds. `pnpm design` runs the impeccable detector on the e2e snapshots of every app page.

## Working here

- Build in vertical slices (db → API → UI → e2e → Chrome check). Infra lands with the first slice that needs it.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e`, then `pnpm design` must pass. Services come up with `pnpm stack`. No `any` without a `// why:` comment.
- Short branches and PRs; a human merges. Every commit is signed off (`git commit -s`, the DCO in CONTRIBUTING.md), and a CI check refuses a PR with a commit that isn't.
- Everything is Apache-2.0; keep `NOTICE`. The name and logo are trademarks (`TRADEMARKS.md`), not part of the licence.
- Tests that matter: `packages/extract` fixtures, `packages/db` scoping and the public projection, `packages/mcp` tool tests, the MCP OAuth end-to-end, Playwright e2e per slice.
- Keep `docs/self-host.md` and `docs/mcp.md` in the same commit as any env var or tool change.
- Never run `cdk deploy`, `vercel deploy` or anything against real AWS or Vercel. Deploying is a human step in `docs/deploy.md`.
