# CLAUDE.md — Pluck

Pluck is a fast, open-source URL saver with an MCP connector. There is no AI inside the app. Read `docs/handover/pluck-technical-spec-v2.md` before any non-trivial change.

## Non-negotiables

- **No model calls on the server.** No LLM SDKs, no embeddings, no vector stores, no "smart" anything. AI features are MCP prompts in `packages/mcp` that a connected client runs. A PR that adds a model call is declined.
- **Only `packages/db` touches MongoDB.** Every query is scoped by `userId`. Every new query gets a two-user test.
- **Public reads use one projection.** `packages/db/public.ts` is the only function that serves public list data. It never joins `contents`, `tags`, `ticked` or `status`. Its field list is pinned by a test.
- **Nothing is deleted by expiry or by MCP.** Expiry and "Archive it all" set `status: archived`. MCP has no delete tool outside the `library:delete` scope, which the consent screen does not request.
- **Every type starts as a Zod schema** in `packages/shared-schemas`. OpenAPI is generated from it.
- **MCP is the only public API.** The REST API serves our clients and the MCP layer. Do not add other integrations.

## Product words

Use these and no others in UI copy: Pluck (verb), Plucked (confirmation), Item, Kind (Read, Watch, PDF, Image, Note, Todo, Thing), Status (Inbox, Later, Archived, Done), Tag, List. Never "saved", "bookmarked", "collection", "smart", "AI-powered", "magic". Say "your AI" or "AI tools", never one vendor as the only option. Expiry copy always says "to the Archive" and "nothing is deleted". No exclamation marks, no emoji.

## Stack

Next.js 16 App Router, TypeScript strict, Node 22, pnpm 10, ESM. MongoDB (Atlas, own `pluck` database). Better Auth. WXT for the extension. Expo plus a Swift share extension for iOS. One Docker image for web and worker. CDK for S3, SES, Route53.

## Design

`packages/ui` holds the tokens, the Logo and Icon components and the seven kind glyphs. Copy values from the `.dc.html` boards in `docs/handover/design/`, never round them. Banned: one-sided accent borders, cards in cards, gradients, glows, Inter, pure black, bounce easing, emoji, dashboards, cream grounds. Run `npx impeccable detect` before opening a PR.

## Working here

- `main` is deployable. Short branches, squash merges. Open a PR; a human merges.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` must pass. No `any` without a `// why:` comment.
- Tests that matter: `packages/extract` fixtures, `packages/db` scoping and the public projection, `packages/mcp` tool tests, the MCP OAuth end-to-end, Playwright smoke.
- Keep `docs/self-host.md` and `docs/mcp.md` in the same PR as any env var or tool change.
- Follow the build order at the end of the technical spec. Each step ends green and deployable.
