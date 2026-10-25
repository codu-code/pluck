import { createHash, randomBytes } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { expect, test } from "@playwright/test";
import { linkFromEmail, openSignInLink, signIn, uniqueEmail } from "./helpers";

const BASE = "http://127.0.0.1:3300";
const REDIRECT = "http://127.0.0.1:4180/callback";

// The whole connector dance an AI tool does: discover, register, authorise in the browser, swap the code, call tools.
test("an AI tool connects over OAuth and calls the connector", async ({ page, request }) => {
  const challenge = await request.post("/mcp", { data: {} });
  expect(challenge.status()).toBe(401);
  const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge.headers()["www-authenticate"] ?? "")?.[1];
  const resource = (await (await request.get(metadataUrl!)).json()) as { resource: string; authorization_servers: string[] };
  expect(resource.resource).toBe(`${BASE}/mcp`);
  const as = (await (await request.get(`${new URL(resource.authorization_servers[0]!).origin}/.well-known/oauth-authorization-server/api/auth`)).json()) as Record<string, string>;

  const reg = await request.post(as.registration_endpoint!, {
    data: { client_name: "Test AI", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] },
  });
  expect(reg.status()).toBe(201);
  const { client_id } = (await reg.json()) as { client_id: string };

  const verifier = randomBytes(32).toString("base64url");
  const authorize = new URL(as.authorization_endpoint!);
  for (const [k, v] of Object.entries({
    response_type: "code", client_id, redirect_uri: REDIRECT, state: "s1", resource: resource.resource,
    scope: "offline_access library:read library:write", code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  })) authorize.searchParams.set(k, v);

  // Signed out: the provider sends you to sign in, and the email link carries on to the consent screen.
  await page.goto(authorize.toString());
  await expect(page).toHaveURL(/\/signin\?/);
  const email = uniqueEmail("mcp");
  const sent = Date.now();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status").filter({ hasText: email })).toBeVisible();
  await openSignInLink(page, await linkFromEmail(email, sent));
  await expect(page.getByRole("heading", { name: "Test AI wants to use your Pluck" })).toBeVisible();
  await expect(page.getByText("Pluck and organise")).toBeVisible();
  await expect(page.getByText("Delete items")).toHaveCount(0);

  const back = page.waitForRequest((r) => r.url().startsWith(REDIRECT));
  await page.getByRole("button", { name: "Allow" }).click();
  const callback = new URL((await back).url());
  expect(callback.searchParams.get("state")).toBe("s1");

  const token = await request.post(as.token_endpoint!, {
    form: { grant_type: "authorization_code", code: callback.searchParams.get("code")!, redirect_uri: REDIRECT, client_id, code_verifier: verifier, resource: resource.resource },
  });
  expect(token.status()).toBe(200);
  const { access_token, refresh_token } = (await token.json()) as { access_token: string; refresh_token?: string };
  expect(refresh_token).toBeTruthy();

  const client = new Client({ name: "test-ai", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(resource.resource), { requestInit: { headers: { authorization: `Bearer ${access_token}` } } }));
  const { tools } = await client.listTools();
  expect(tools).toHaveLength(12); // no delete_item: the consent did not grant library:delete
  const text = (r: Awaited<ReturnType<typeof client.callTool>>) => {
    expect(r.isError, JSON.stringify(r.content)).toBeFalsy();
    return JSON.parse((r.content as { text: string }[])[0]!.text);
  };
  const call = async (name: string, args: Record<string, unknown> = {}) => text(await client.callTool({ name, arguments: args }));

  const { saved } = await call("save_item", { url: "http://127.0.0.1:4180/news-1.html" });
  const id = saved[0].id as string;
  const { tag } = await call("create_tag", { name: "Teams" });
  await call("batch_update", { itemIds: [id], patch: { addTagIds: [tag.id] } });
  const { list } = await call("create_list", { name: "Reading", purpose: "For the talk", items: [{ itemId: id, note: "start here" }] });
  await call("update_list", { id: list.id, entries: [{ itemId: id, ticked: true }] });
  expect((await call("search_items", { query: "finishing problem" })).items[0].tags).toEqual(["Teams"]);
  expect((await call("list_items", { status: "inbox" })).items).toHaveLength(1);
  expect((await call("get_item", { id })).text).toContain("finishing problem");
  expect((await call("list_tags")).tags).toHaveLength(1);
  expect((await call("list_lists")).lists).toHaveLength(1);
  expect((await call("get_list", { id: list.id })).entries[0]).toMatchObject({ note: "start here", noteBy: "ai", ticked: true });
  expect(await call("get_digest")).toHaveProperty("expiring");
  expect(((await client.readResource({ uri: `item://${id}` })).contents[0] as { text: string }).text).toContain("finishing problem");
  expect(((await client.readResource({ uri: `list://${list.id}` })).contents[0] as { text: string }).text).toContain("start here");
  for (const p of (await client.listPrompts()).prompts) {
    const got = await client.getPrompt({ name: p.name, arguments: p.name === "content_ideas" ? { topic: "small teams" } : {} });
    expect(got.messages).toHaveLength(1);
  }
  await client.close();

  // What the person sees: the list the AI made, and the connection in Settings, which they can cut off at once.
  await page.goto(`/lists/${list.id}`);
  await expect(page.getByText("start here")).toBeVisible();
  await page.goto("/settings");
  const ai = page.locator("#ai");
  await expect(ai.getByText(/^Connected/)).toBeVisible();
  await expect(ai.getByText("Test AI")).toBeVisible();
  await expect(ai.locator("code").first()).toHaveText(`${BASE}/mcp`);
  await ai.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Test AI disconnected.")).toBeVisible();
  const after = await request.post("/mcp", { headers: { authorization: `Bearer ${access_token}`, accept: "application/json, text/event-stream" }, data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} } });
  expect(after.status()).toBe(401);
  expect(after.headers()["www-authenticate"]).toContain("resource_metadata=");
});

test("a personal API key works as a bearer token, and a bad one is refused", async ({ page, request }) => {
  await signIn(page);
  const { key } = (await (await page.request.post("/api/v1/api-keys", { data: { name: "Claude Code" } })).json()) as { key: string };
  const client = new Client({ name: "script", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
  expect((await client.listTools()).tools.map((t) => t.name)).toContain("save_item");
  await client.close();

  // The same key through the stdio bridge, the way a self-hoster's desktop app would run `npx @pluck/mcp`.
  const local = new Client({ name: "desktop-app", version: "1.0.0" });
  await local.connect(new StdioClientTransport({ command: process.execPath, args: ["packages/mcp-stdio/src/cli.ts", "--server", BASE, "--key", key] }));
  const saved = await local.callTool({ name: "save_item", arguments: { text: "Plucked through the bridge", kind: "note" } });
  expect(JSON.parse((saved.content as { text: string }[])[0]!.text).saved[0].title).toBe("Plucked through the bridge");
  await local.close();
  const bad = await request.post("/mcp", { headers: { authorization: "Bearer pk_live_nope" }, data: {} });
  expect(bad.status()).toBe(401);
});
