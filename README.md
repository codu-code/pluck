# Pluck

A fast, open-source URL saver with a connector for the AI tool you already use. Pluck anything in one tap, from the iPhone share sheet, the browser, email or a chat with your AI. The page is kept, not just the link. Sort it later, by hand or with your AI. There is no AI inside the app; your AI reads and organises your library through the connector, only when you ask.

Hosted at [getpluck.io](https://getpluck.io), or run your own with `docker compose up` ([docs/self-host.md](docs/self-host.md)).

## What is where

- **Web:** `apps/web` (Next.js 16): the app, the marketing site, the REST API for our own clients, the MCP connector at `/mcp`, and the worker (`apps/web/worker.ts`) that reads pages, sends email and runs the schedule.
- **Browser extension:** `apps/extension` (WXT; Chrome, and Firefox builds for self-hosters).
- **iPhone:** `apps/ios` (Expo) with a SwiftUI share extension. Sign-in is by a 6-digit code; it works offline from the last copy and keeps the newest Items for reading on the go.
- **Packages:**
  - `packages/db`: the only code that touches MongoDB. Every query is scoped to one person.
  - `packages/extract`: reading pages, PDFs, email and imports.
  - `packages/blob`: S3 (MinIO locally).
  - `packages/mcp`: the connector's tools, resources and prompts. `packages/mcp-stdio` is `npx @getpluck/mcp` ([npm](https://www.npmjs.com/package/@getpluck/mcp)).
  - `packages/shared-schemas`: every type, as a Zod schema, shared by server and clients.
  - `packages/client`: the API client, offline queue and PKCE shared by the iPhone app and the extension.
  - `packages/i18n`: the words in ten languages (English, Spanish, Portuguese (Brazil), French, German, Japanese, Italian, Dutch, Korean, Chinese (Simplified)).
  - `packages/ui`: design tokens, the logo, the icon and the seven Kind glyphs.
- **Infra:** `infra/cdk` (S3 and SES for getpluck.io). `docker-compose.yml` for self-hosting, `docker-compose.dev.yml` for development.

[docs/architecture.md](docs/architecture.md) is the map: how a pluck travels, where the rules live, and where the code could be deeper.

## Run it locally

You need Node 22, pnpm 10 (`corepack enable` picks the pinned version) and Docker.

```sh
pnpm install
cp .env.example .env    # local values only; nothing in it is a real secret
pnpm stack              # MongoDB, Mailpit, MinIO and the fixture pages, on offset ports, bound to 127.0.0.1
pnpm dev                # the web app at http://127.0.0.1:3000
```

Sign in with any address: the email (a link and a code) lands in Mailpit at http://127.0.0.1:8035. Plucking a single link reads the page at once; imports, uploaded files, email-in and the Monday email need the worker in a second terminal:

```sh
pnpm --filter @pluck/web worker
```

- **Extension:** `PLUCK_LOCAL=1 pnpm --filter @pluck/extension dev` opens Chrome with an extension that talks to your local server. Without `PLUCK_LOCAL=1` it talks to getpluck.io.
- **iPhone:** see [docs/ios.md](docs/ios.md) (needs a Mac with Xcode).
- **AI tools:** connect one to `http://127.0.0.1:3000/mcp`, or try `npx @modelcontextprotocol/inspector`. See [docs/mcp.md](docs/mcp.md).
- `pnpm stack:down` stops the services. Their data stays in Docker volumes.

## Tests

The gate, in this order. CI runs the same on every pull request.

```sh
pnpm typecheck
pnpm lint
pnpm test        # Vitest; brings up the Docker services itself
pnpm exec playwright install chromium   # once
pnpm e2e         # Playwright against a production build on port 3300
pnpm design      # the impeccable design detector on every page the e2e run saved
```

Stop `pnpm dev` before `pnpm e2e`: both use `apps/web/.next`.

## Docs

- [docs/architecture.md](docs/architecture.md): how the pieces fit, for a newcomer.
- [docs/self-host.md](docs/self-host.md): run your own, and every setting.
- [docs/mcp.md](docs/mcp.md): the connector, its tools and how to connect an AI tool.
- [docs/ios.md](docs/ios.md): the iPhone app, its share extension, offline and TestFlight (`apps/ios/scripts/testflight.sh`).
- [docs/i18n.md](docs/i18n.md): the ten languages and how to add a string.
- [docs/deploy.md](docs/deploy.md): how getpluck.io is deployed (a human step; nothing here deploys itself).
- [docs/design-gaps.md](docs/design-gaps.md): screens and copy that still want a designer.
- [docs/launch-checklist.md](docs/launch-checklist.md): what is left before launch.
- [GLOSSARY.md](GLOSSARY.md): the product words. [CLAUDE.md](CLAUDE.md): the rules of the codebase, for people and coding agents.

## Contributing

Bug reports, fixes and ideas are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Found a security problem? Please follow [SECURITY.md](SECURITY.md) instead of opening an issue. Everyone here follows the [code of conduct](CODE_OF_CONDUCT.md).

Questions about using Pluck: [getpluck.io/support](https://getpluck.io/support).

## Licence

Everything here, the server, the apps and the packages, is under the [Apache License 2.0](LICENSE). Use it, change it, run it, build on it, commercially too; keep the [`NOTICE`](NOTICE) file with it.

The name Pluck and the logo are not part of the licence: see [TRADEMARKS.md](TRADEMARKS.md). Fork it under your own name.
