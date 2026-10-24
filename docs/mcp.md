# The Pluck connector (MCP)

Pluck has no AI inside it. The connector lets the AI tool you already use read and organise your library, when you ask it to. It is the only public API we promise to keep stable.

The endpoint is `https://getpluck.io/mcp` (or `<your server>/mcp` when you self-host). It speaks MCP over streamable HTTP, stateless, and serves both the 2026-07-28 and 2025-era protocol revisions.

## Connect

| Client | How |
|---|---|
| Claude (web, desktop, mobile) | Settings, Connectors, Add custom connector, paste the connector URL |
| ChatGPT | Settings, Connectors, Create, paste the connector URL |
| Claude Code | `claude mcp add --transport http pluck https://getpluck.io/mcp`, or add `--header "Authorization: Bearer pk_live_…"` to use a key |
| Cursor and other editors | `{ "mcpServers": { "pluck": { "url": "https://getpluck.io/mcp" } } }` in `mcp.json` |
| Anything that only speaks stdio | `npx @pluck/mcp --server https://your.server --key pk_live_…` (the key can come from `PLUCK_API_KEY`) |

Settings, AI tools in Pluck shows the same lines, which tools are connected, when one last called, and a Disconnect button for each.

## Sign-in

OAuth 2.1 with PKCE (S256) and a resource indicator. A call without a token gets a `401` whose `WWW-Authenticate` header points at `/.well-known/oauth-protected-resource/mcp`. That names the authorisation server (`/api/auth`), whose metadata is at `/.well-known/oauth-authorization-server/api/auth`.

- **Client ID metadata documents** (CIMD) are supported: a client whose `client_id` is an HTTPS URL is looked up there, with no registration.
- **Dynamic client registration** is the fallback, at `/api/auth/oauth2/register`.
- The person signs in with an email link and sees one consent screen (`/oauth/consent`) with the scopes in plain words.
- Access tokens are JWTs for the `/mcp` audience, valid for an hour, with refresh tokens for 90 days. Disconnecting in Settings cuts a tool off at once, even mid-token.
- Personal API keys (`pk_live_…`, made in Settings) work as bearer tokens for scripts, Claude Code and the stdio bridge.

## Scopes

| Scope | Gives |
|---|---|
| `library:read` | The read tools, both resources and the prompts |
| `library:write` | Saving and organising: the write tools |
| `library:delete` | `delete_item`, which moves an item to the bin. Not requested by default |

A tool is only listed when the token carries its scope.

## Tools

| Tool | What it does |
|---|---|
| `search_items` | Text search; `query, kinds[], tagIds[], listId, status, since, limit (max 25), cursor` |
| `list_items` | Browse by status; `status, kinds[], sort (newest, untouched), limit (max 25), cursor` |
| `get_item` | One item with its kept text (paged at about 20k tokens, follow `textCursor`), note, highlights and lists |
| `save_item` | Pluck a URL, every URL in a block of text, or a note, todo or thing; `url or text, kind, title, note, tagIds[], listId, dueAt`. Saving a link twice brings it back to the Inbox. Unknown `tagIds` or `listId` refuse the call before anything is saved |
| `batch_update` | One change over up to 100 items: status, kind, due date, note, add or remove tags. Unknown tags are refused with the nearest existing ones; tags are never created here |
| `list_tags` | Tags with counts, and whether an AI made them; paged with `cursor` |
| `create_tag` | A new tag, only after the person agreed. Marked as made by AI |
| `list_lists` | Lists with purpose, counts and visibility |
| `get_list` | One list in order, with each item's note and tick |
| `create_list` | A private list with a purpose and ordered items, each with an optional note. Marked as made by AI |
| `update_list` | Rename, add, remove, reorder, set notes and ticks, make a list private. The purpose is read-only. Only the person can make a list public, in Pluck: a saved page could otherwise talk an AI into publishing |
| `get_digest` | What is expiring, due, oldest in the Inbox, and quiet lists |
| `delete_item` | Moves an item to the bin (30 days). Only with `library:delete` |

Results are cards: `id, title, kind, siteName, excerpt, tags, savedAt, url`. Responses stay around 8k tokens; anything longer pages with an opaque `nextCursor`. Errors come back as `{ "error": { "code", "message", "details"? } }` with `isError: true`.

Everything an AI tool changes is marked "by AI" in Pluck: its tags until the person touches them, its list notes, its lists and its saves (`source: mcp`). Settings has "Remove everything AI tagged this week".

## Resources

- `item://{id}`: one item as Markdown (title, link, note, kept text).
- `list://{id}`: one list as Markdown, in order, with notes. Lists are listed, so a person can attach one to a chat.

## Prompts

| Prompt | What it does |
|---|---|
| `tidy_inbox` | Proposes tags from your vocabulary and a keep, later or archive call per Inbox item, then applies it on your yes |
| `build_list` | Gathers what you plucked on a topic or in a window into ordered lists, made private on your yes |
| `content_ideas` | Reads the strongest items on a topic and drafts three angles with sources |
| `weekly_review` | Walks the digest one decision at a time |

## Limits

300 requests a minute per IP and 600 a minute per person. Over that is a `429` with `Retry-After`.

## Developing

- `packages/mcp` holds the tools, resources and prompts. It sees the library only through `PluckLibrary` (`packages/mcp/src/library.ts`); `apps/web/lib/connector.ts` binds it to the in-process library for one person, with every write marked as made by AI.
- `apps/web/app/mcp/route.ts` authenticates (OAuth token or API key), rate limits and serves.
- `packages/mcp-stdio` is the `npx @pluck/mcp` bridge.
- Tests: `apps/web/lib/connector.test.ts` (every tool against a seeded database), `apps/web/lib/cimd.test.ts`, `packages/mcp-stdio/src/bridge.test.ts`, and `e2e/mcp.spec.ts` (the full OAuth dance, every tool, resource and prompt over HTTP, Disconnect, API keys and the stdio bridge).
- Try it by hand: `npx @modelcontextprotocol/inspector`, then connect to `http://localhost:3000/mcp`.
