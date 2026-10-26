# @getpluck/mcp

[npm](https://www.npmjs.com/package/@getpluck/mcp)

Your [Pluck](https://getpluck.io) library in any MCP client that speaks stdio, with an API key. Clients that connect to
a remote server (Claude, ChatGPT, Cursor) can use `https://getpluck.io/mcp` directly and need none of this.

```sh
npx @getpluck/mcp --key pk_live_…
```

Make a key in Pluck, Settings, AI tools. The key can also come from `PLUCK_API_KEY`. Running your own Pluck? Add
`--server https://pluck.example.com` (or set `PLUCK_SERVER`).

In a client's config:

```json
{ "mcpServers": { "pluck": { "command": "npx", "args": ["@getpluck/mcp"], "env": { "PLUCK_API_KEY": "pk_live_…" } } } }
```

Requires Node 22. Apache-2.0. Source: [codu-code/pluck](https://github.com/codu-code/pluck/tree/main/packages/mcp-stdio).
