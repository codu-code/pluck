#!/usr/bin/env node
import { parseArgs } from "node:util";
import { bridge } from "./bridge.ts";

const USAGE = `Usage: npx @pluck/mcp [--server https://getpluck.io] --key pk_live_…

Connects any stdio MCP client to your Pluck library. Make a key in Pluck, Settings, API keys.
The key can also come from PLUCK_API_KEY, and the server from PLUCK_SERVER.`;

const { values } = parseArgs({ options: { server: { type: "string" }, key: { type: "string" }, help: { type: "boolean", short: "h" } } });
const key = values.key ?? process.env.PLUCK_API_KEY;
const server = values.server ?? process.env.PLUCK_SERVER ?? "https://getpluck.io";

if (values.help || !key?.startsWith("pk_live_")) {
  console.error(USAGE); // stdout belongs to the MCP client
  process.exit(values.help ? 0 : 1);
}

try {
  await bridge({ server, key });
} catch (e) {
  console.error(`pluck-mcp: could not reach ${server}/mcp: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
