import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { expect, test } from "vitest";
import { z } from "zod";
import { bridge } from "./bridge";

// A stand-in remote connector, served over a fetch function, so the bridge is tested without a network.
function remote(seen: string[]) {
  const handler = createMcpHandler(() => {
    const s = new McpServer({ name: "remote", version: "1.0.0" }, { instructions: "be kind" });
    s.registerTool("echo", { description: "Echo.", inputSchema: z.object({ text: z.string() }) }, async ({ text }) => ({ content: [{ type: "text", text }] }));
    s.registerPrompt("hello", { description: "Hi." }, () => ({ messages: [{ role: "user", content: { type: "text", text: "hello" } }] }));
    s.registerResource("note", "note://one", { mimeType: "text/plain" }, async (uri) => ({ contents: [{ uri: uri.href, text: "one" }] }));
    return s;
  });
  return async (url: string | URL, init?: RequestInit) => {
    seen.push(new Headers(init?.headers).get("authorization") ?? "");
    return handler.fetch(new Request(url, init));
  };
}

test("tools, prompts and resources pass through, with the key on every remote request", async () => {
  const seen: string[] = [];
  const [clientSide, bridgeSide] = InMemoryTransport.createLinkedPair();
  const handle = await bridge({ server: "http://pluck.test", key: "pk_live_abc", transport: bridgeSide, fetch: remote(seen) });
  const client = new Client({ name: "desktop-app", version: "1.0.0" });
  await client.connect(clientSide);

  expect((await client.listTools()).tools.map((t) => t.name)).toEqual(["echo"]);
  expect(await client.callTool({ name: "echo", arguments: { text: "hi" } })).toMatchObject({ content: [{ type: "text", text: "hi" }] });
  expect((await client.getPrompt({ name: "hello" })).messages).toHaveLength(1);
  expect((await client.readResource({ uri: "note://one" })).contents[0]).toMatchObject({ text: "one" });
  expect(client.getInstructions()).toBe("be kind");
  expect(seen.length).toBeGreaterThan(0);
  expect(new Set(seen)).toEqual(new Set(["Bearer pk_live_abc"]));
  await client.close();
  await handle.close();
});
