# Pluck

A fast, open-source URL saver with a connector for the AI tool you already use. Pluck anything in one tap, from the iPhone share sheet, the browser, email or a chat with your AI. The page is kept, not just the link. Sort it later, by hand or with your AI. There is no AI inside the app; your AI reads and organises your library through the connector, only when you ask.

- **Web:** `apps/web` (Next.js): the app, the marketing site, the REST API for our own clients, and the MCP connector at `/mcp`.
- **Browser extension:** `apps/extension` (WXT, Chrome and Firefox).
- **iPhone:** `apps/ios` (Expo) with a SwiftUI share extension.
- **Packages:** `packages/db` (the only code that touches MongoDB), `packages/extract` (page, PDF and email reading), `packages/mcp` (the connector's tools, resources and prompts), `packages/mcp-stdio` (`npx @pluck/mcp`), `packages/shared-schemas`, `packages/ui`, `packages/blob`.
- **Infra:** `infra/cdk` (S3 and SES).

## Docs

- `docs/self-host.md`: run your own with `docker compose up`.
- `docs/mcp.md`: connect an AI tool.
- `docs/ios.md`: the iPhone app and its share extension.
- `docs/deploy.md`: how getpluck.io is deployed.
- `docs/launch-checklist.md`: what is left before launch.
- `docs/design-gaps.md`: screens and copy that still want a designer.

## Develop

Node 22, pnpm 10, Docker.

```sh
pnpm install
cp .env.example .env
pnpm stack            # MongoDB, Mailpit, MinIO and the fixture pages, on offset ports
pnpm dev              # http://127.0.0.1:3000; sign-in links arrive in Mailpit at http://127.0.0.1:8035
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e`, then `pnpm design`. `CLAUDE.md` has the rules of the codebase, and `GLOSSARY.md` the words.
