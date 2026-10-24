# Contributing to Pluck

Thanks for wanting to help. Pluck is small on purpose, and these notes keep it that way.

## Before you start

- **Bugs:** open an issue with the steps to see it. A failing test is even better.
- **Ideas:** open an issue first and say what gets in your way. A short chat saves a long pull request that does not fit.
- **Security problems:** never in an issue. See [SECURITY.md](SECURITY.md).
- **Small fixes** (a typo, a broken link, an obvious bug): just open the pull request.

## Set up

You need Node 22, pnpm 10 and Docker.

```sh
pnpm install
cp .env.example .env
pnpm stack            # MongoDB, Mailpit, MinIO and the fixture pages, on offset ports, bound to 127.0.0.1
pnpm dev              # http://127.0.0.1:3000
```

Sign in with any address: the link lands in Mailpit at http://127.0.0.1:8035. The extension is in `apps/extension` (`pnpm --filter @pluck/extension dev`), the iPhone app in `apps/ios` (see [docs/ios.md](docs/ios.md)).

## The gate

Every pull request passes these, in this order. CI runs them too.

```sh
pnpm typecheck
pnpm lint
pnpm test       # Vitest; starts the Docker services itself
pnpm e2e        # Playwright against a production build
pnpm design     # the impeccable detector on every page the e2e run saved
```

Stop `pnpm dev` before `pnpm e2e`: both use `apps/web/.next`.

## House rules

These are the ones a review will ask about. [CLAUDE.md](CLAUDE.md) has the full list, and [GLOSSARY.md](GLOSSARY.md) the words.

1. **No AI inside the app.** No model calls, embeddings or vector stores on the server. AI features are MCP prompts in `packages/mcp` that the person's own AI runs.
2. **Only `packages/db` touches MongoDB.** Every query is scoped by `userId`, and every new query gets a test with two people in it.
3. **Public lists read through one function**, `packages/db/src/public.ts`, whose fields are pinned by a test.
4. **Nothing is deleted by expiry or by an AI tool.** Expiry archives. MCP has no delete tool unless the person grants `library:delete`.
5. **Types start as Zod schemas** in `packages/shared-schemas`.
6. **MCP is the only public API.** The REST API serves our own apps.
7. **Copy uses the product words:** Pluck (the verb), Plucked, Item, Kind, Status, Tag, List. Never "saved" or "bookmarked". No exclamation marks, no emoji. Say "your AI", never one vendor as the only option.
8. **Docs move with the code:** a new env var goes in `docs/self-host.md`, a new MCP tool in `docs/mcp.md`, in the same pull request.
9. **No `any`** without a `// why:` comment.

## Style

- Read the code around your change and write like it: the same comment density, names and idioms. Comments say why, not what.
- The smallest change that fully solves the problem. No options, layers or config nobody asked for.
- New logic with a branch, a parser or a data write comes with one test that would fail without it.
- UI follows the boards in `docs/handover/design/` and the tokens in `packages/ui`. Copy values, never round them. No gradients, glows, one-sided accent borders or cards in cards.

## Pull requests

- One change per pull request, on a short branch.
- Fill in the template: what and why, how you checked it, screenshots for anything visible (light and dark, wide and phone).
- A maintainer reviews and squash-merges. Merging to `main` deploys getpluck.io, so `main` stays green.

## Licence

By contributing you agree your work is released under the licence of the folder you changed: AGPL-3.0 for the server and everything it runs on, MIT for the apps and the packages others build on. See the [README](README.md#licence).
