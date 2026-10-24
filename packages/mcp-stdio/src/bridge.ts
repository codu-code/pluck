import { Client, StreamableHTTPClientTransport, type FetchLike } from "@modelcontextprotocol/client";
import { Server, type Transport } from "@modelcontextprotocol/server";
import { serveStdio, type StdioServerHandle } from "@modelcontextprotocol/server/stdio";

export type BridgeOptions = {
  server: string; // the Pluck origin, e.g. https://getpluck.io or http://localhost:3000
  key: string; // a personal API key, pk_live_…
  transport?: Transport; // tests: an in-memory pair instead of this process's stdio
  fetch?: FetchLike;
};

// Serves the remote connector over stdio: each request from the local client is replayed through an SDK
// client to <server>/mcp, so both sides negotiate their own protocol version and nothing is rewritten by hand.
export async function bridge({ server, key, transport, fetch }: BridgeOptions): Promise<StdioServerHandle> {
  const remote = new Client({ name: "pluck-stdio", version: "0.1.0" });
  await remote.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", server), { requestInit: { headers: { authorization: `Bearer ${key}` } }, fetch }),
  );
  const instructions = remote.getInstructions();
  return serveStdio(
    () => {
      const local = new Server({ name: "pluck", title: "Pluck", version: "0.1.0" }, { capabilities: { tools: {}, resources: {}, prompts: {} }, instructions });
      local.setRequestHandler("tools/list", (r) => remote.listTools(r.params));
      local.setRequestHandler("tools/call", (r) => remote.callTool(r.params));
      local.setRequestHandler("resources/list", (r) => remote.listResources(r.params));
      local.setRequestHandler("resources/templates/list", (r) => remote.listResourceTemplates(r.params));
      local.setRequestHandler("resources/read", (r) => remote.readResource(r.params));
      local.setRequestHandler("prompts/list", (r) => remote.listPrompts(r.params));
      local.setRequestHandler("prompts/get", (r) => remote.getPrompt(r.params));
      return local;
    },
    { transport, onerror: (e) => console.error(`pluck-mcp: ${e.message}`) },
  );
}
