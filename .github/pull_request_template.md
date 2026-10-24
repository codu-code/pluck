## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## How it was checked

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`
- [ ] `pnpm e2e`, then `pnpm design`
- [ ] Screenshots for anything you can see (light and dark, wide and phone)

## The house rules (CONTRIBUTING.md)

- [ ] No model calls on the server
- [ ] Only `packages/db` touches MongoDB, every query is scoped by `userId`, and a new query has a two-user test
- [ ] New types start as a Zod schema in `packages/shared-schemas`
- [ ] UI copy uses the product words (`GLOSSARY.md`): no "saved", no exclamation marks, no emoji
- [ ] A new env var or MCP tool is in `docs/self-host.md` or `docs/mcp.md` in this same PR
