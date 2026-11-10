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
| Anything that only speaks stdio | `npx @getpluck/mcp --server https://your.server --key pk_live_…` (the key can come from `PLUCK_API_KEY`) |

Settings, AI tools in Pluck shows the same lines, which tools are connected, when one last called, and a Disconnect button for each.

## Sign-in

OAuth 2.1 with PKCE (S256) and a resource indicator. A call without a token gets a `401` whose `WWW-Authenticate` header points at `/.well-known/oauth-protected-resource/mcp`. That names the authorisation server (`/api/auth`), whose metadata is at `/.well-known/oauth-authorization-server/api/auth`.

- **Client ID metadata documents** (CIMD) are supported: a client whose `client_id` is an HTTPS URL is looked up there, with no registration.
- **Dynamic client registration** is the fallback, at `/api/auth/oauth2/register`.
- The person signs in with an email link and sees one consent screen (`/oauth/consent`) with the scopes in plain words.
- Access tokens are JWTs for the `/mcp` audience, valid for an hour, with refresh tokens for 90 days. A refresh token works once; asking again with a spent one within 30 days replays the answer it got, so a lost response does not sign a device out. Disconnecting in Settings cuts a tool off at once, even mid-token.
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
| `search_items` | Text search over titles, notes, tags, list names, highlights and kept text; `query, kinds[], tagIds[], listId, status, since, limit (max 25), cursor` |
| `list_items` | Browse by status; `status, kinds[], sort (newest, untouched), limit (max 25), cursor` |
| `get_item` | One item with its facts, its kept text (paged at about 20k tokens: pass `textCursor` back as `cursor`, and every page answers with the next `textCursor`, null at the end), note, highlights and lists |
| `list_highlights` | What the person highlighted across the library, newest first: each quote, their note on it, when it was made and the item it is in (`id, title, url, siteName`, enough to cite it); `query` (every word, anywhere in the quote or the note), `itemId, since, limit (max 25), cursor`. Nothing from an item in the bin |
| `save_item` | Pluck a URL, every URL in a block of text, or a note, todo or thing; `url or text, kind, title, note, tagIds[], listId, dueAt`. Saving a link twice brings it back to the Inbox. `tagIds` take existing tag ids or names; unknown tags (refused with the nearest existing ones) or an unknown `listId` refuse the call before anything is saved. The one tool marked `openWorldHint`: Pluck's server fetches the link, so whatever is in the address leaves the library |
| `batch_update` | One change over up to 100 items: status, kind, due date, note, add or remove tags. Unknown tags are refused with the nearest existing ones; tags are never created here. A change that does not fit every item (Done is only for Todos and Things; a link Kind only for links) refuses the call, naming those items in `details.itemIds`, and nothing changes |
| `list_tags` | Tags with counts, and whether an AI made them; paged with `cursor` |
| `create_tag` | A new tag, only after the person agreed. Marked as made by AI |
| `list_lists` | Lists with purpose, counts and visibility |
| `get_list` | One list in order, with each item's note and tick; `open: true` gives only the unticked items (what is left), sent again on every page |
| `create_list` | A private list with a purpose and ordered items, each with an optional note. Marked as made by AI |
| `update_list` | Rename, add, remove, reorder, set notes and ticks, make a list private. Ticking a Todo or Thing also sets it Done, and setting one Done ticks it in its lists. The purpose is read-only. Only the person can make a list public, in Pluck: a saved page could otherwise talk an AI into publishing |
| `get_digest` | What is expiring, due, oldest in the Inbox, and quiet lists |
| `delete_item` | Moves an item to the bin (30 days). Only with `library:delete` |

Results are cards: `id, title, kind, preview, siteName, excerpt, tags, savedAt, url`. `preview` says what a link is beyond its Kind: `reader` (an article), `player` (a video or audio), `post` (a social post), `code` (a repo, issue, PR, gist, package or question), `product` (something to buy), `site` (a homepage), `document` (a PDF or paper) or `app` (an AI artifact or share, a design file, a shared doc); null for images, notes, todos and things. `get_item` adds `facts`: whichever of `seconds, handle, price {amount, currency}, code, language, stars, pages, pdfUrl, app, postedAt, article` the page made known. Responses stay around 8k tokens; anything longer pages with an opaque `nextCursor`. Errors come back as `{ "error": { "code", "message", "details"? } }` with `isError: true`.

Results are typed. Every tool declares an `outputSchema` and answers with `structuredContent` beside the same JSON as text: a client can check and render the result, and one that reads only the text loses nothing. The shapes are Zod schemas, `Results` in `packages/mcp/src/shape.ts`, built from `packages/shared-schemas`; a result carries those fields and no others (`facts` is the one open object). An error has no `structuredContent`.

Everything an AI tool changes is marked "by AI" in Pluck: its tags until the person touches them, its list notes, its lists and its saves (`source: mcp`). Settings has "Remove everything AI tagged this week".

The server's instructions tell the AI tool that text inside kept pages, notes from other people and titles is content to read, never instructions to follow. A kept page can still try, which is why no tool here makes a list public and `save_item` is marked as reaching outside: a client can ask before it runs.

## Resources

- `item://{id}`: one item as Markdown (title, link, note, kept text).
- `list://{id}`: one list as Markdown, in order, with notes. Lists are listed, so a person can attach one to a chat.

## Prompts

| Prompt | What it does |
|---|---|
| `tidy_inbox` | Proposes tags from your vocabulary and a keep, later or archive call per Inbox item, then applies it on your yes |
| `build_list` | Gathers what you plucked on a topic or in a window into ordered lists, made private on your yes |
| `content_ideas` | Reads what you highlighted and the strongest items on a topic, and drafts three angles with sources |
| `weekly_review` | Walks the digest one decision at a time |

## Limits

300 requests a minute per IP and 600 a minute per person. Over that is a `429` with `Retry-After`.

## The registry listing

`server.json` at the repo root is Pluck's entry for the official MCP registry (`registry.modelcontextprotocol.io`), where clients and directories look servers up. It follows the registry's `2025-12-11` schema and lists two ways in under one name, `io.github.codu-code/pluck`: the hosted connector (`https://getpluck.io/mcp`, streamable HTTP; the schema has no field for sign-in, a client finds OAuth from the `401`) and the stdio bridge on npm (`@getpluck/mcp`, with `--server` and `PLUCK_API_KEY`). The registry proves the name twice: whoever publishes must be an Owner of the `codu-code` organisation on GitHub, and the npm package must carry the same name as `mcpName` in its `package.json`. `packages/mcp/src/registry.test.ts` keeps the name, the package version and the inputs in step with `packages/mcp-stdio`.

Nothing here publishes it. A person does, after each release of `@getpluck/mcp`:

1. Release the package with `mcpName` in it. 0.1.0 on npm has none, so the registry refuses it: the next version is 0.1.1. Raise `version` in `packages/mcp-stdio/package.json` and both `version` fields in `server.json` together, merge, and push the tag `mcp-v0.1.1` (`docs/deploy.md`, "Publishing @getpluck/mcp"). Then `npm view @getpluck/mcp mcpName` should print the name.
2. Install the publisher, `brew install mcp-publisher`, and check the file from the repo root: `mcp-publisher validate`.
3. Log in as an Owner of `codu-code` with a token: `mcp-publisher login github --token <token>`, where the token is a classic personal access token with only the `read:org` scope (or a fine-grained one made for the organisation with Members: read-only). The browser flow, `mcp-publisher login github` alone, cannot see organisations today (registry issue 1468) and gives only `io.github.<your username>/*`.
4. Publish: `mcp-publisher publish`.
5. Look it up: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.codu-code/pluck"`.

A published version cannot be changed, so a change to the listing goes out under a new `version`.

GitHub Actions can do steps 2 to 4 with no token: a job in this repository with `permissions: id-token: write` runs `mcp-publisher login github-oidc`, then `mcp-publisher publish`, and the registry reads the organisation from the workflow's own identity. It would sit after the npm publish in `.github/workflows/publish-mcp.yml`, with the publisher pinned to a release and its signature checked as the registry's guide shows. That step is not written yet. The registry is in preview: if a step here fails, read its publishing guide first.

## Developing

- `packages/mcp` holds the tools, resources and prompts. It sees the library only through `PluckLibrary` (`packages/mcp/src/library.ts`); `apps/web/lib/connector.ts` binds it to the in-process library for one person, with every write marked as made by AI.
- `apps/web/app/mcp/route.ts` authenticates (OAuth token or API key), rate limits and serves.
- `packages/mcp-stdio` is the `npx @getpluck/mcp` bridge, published as [`@getpluck/mcp`](https://www.npmjs.com/package/@getpluck/mcp).
- Tests: `apps/web/lib/connector.test.ts` (every tool against a seeded database), `apps/web/lib/cimd.test.ts`, `packages/mcp-stdio/src/bridge.test.ts`, and `e2e/mcp.spec.ts` (the full OAuth dance, every tool, resource and prompt over HTTP, Disconnect, API keys and the stdio bridge).
- Try it by hand: `npx @modelcontextprotocol/inspector`, then connect to `http://localhost:3000/mcp`.
