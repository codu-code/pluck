// Fills a local server with a demo library and prints an API key for it, for screenshots and trying the apps.
// Usage: node scripts/demo-seed.mjs [server] [email]   (defaults: http://127.0.0.1:3000, demo-ios@example.test)
// Needs `pnpm stack` (Mailpit and the fixture pages) and the app running on that server.
const server = process.argv[2] ?? "http://127.0.0.1:3000";
const email = process.argv[3] ?? "demo-ios@example.test";
const MAILPIT = "http://127.0.0.1:8035";
const FIX = "http://127.0.0.1:4180";

const sent = Date.now();
const ask = await fetch(`${server}/api/auth/sign-in/magic-link`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: server },
  body: JSON.stringify({ email, callbackURL: "/inbox" }),
});
if (!ask.ok) throw new Error(`magic link: ${ask.status} ${await ask.text()}`);

let link;
for (let i = 0; i < 40 && !link; i++) {
  const { messages } = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
  const fresh = messages.find((m) => new Date(m.Created).getTime() >= sent - 1000);
  if (fresh) link = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()).Text.match(/https?:\/\/\S+/)?.[0];
  else await new Promise((r) => setTimeout(r, 250));
}
if (!link) throw new Error("no email arrived");
const verify = await fetch(link, { redirect: "manual" });
const cookie = verify.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const call = async (path, body, method = "POST", auth = { cookie }) => {
  const res = await fetch(`${server}${path}`, { method, headers: { "content-type": "application/json", origin: server, ...auth }, body: body && JSON.stringify(body) });
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const { key } = await call("/api/v1/api-keys", { name: "iPhone demo" });
const bearer = { authorization: `Bearer ${key}` };
const api = (path, body, method) => call(path, body, method, bearer);

await api("/api/v1/me", { name: "Demo Person", handle: `demo${Date.now().toString(36).slice(-4)}` }, "PATCH");
const tag = async (name) => (await api("/api/v1/tags", { name })).tag.id;
const [teams, kitchen] = [await tag("teams"), await tag("kitchen")];
await tag("reading");

const ids = {};
for (const page of ["video-watch.html?v=abc123", "docs-1.html", "news-2.html", "blog-1.html", "news-1.html"]) {
  const { results } = await api("/api/v1/items", { url: `${FIX}/${page}`, source: "ios" });
  ids[page] = results[0].item.id;
}
const note = async (text, kind = "note", dueAt) => (await api("/api/v1/items", { text, kind, ...(dueAt ? { dueAt } : {}) })).results[0].item.id;
await note("An MCP server for estimates\nTools for quotes, a prompt for the weekly numbers.");
const todo = await note("Outline the November talk", "todo", new Date(Date.now() + 3 * 86_400_000).toISOString());
const hob = await note("Induction hob, 60 cm, four zones", "thing");
const tap = await note("Tap with a pull-out spray", "thing");
await api(`/api/v1/items/${ids["news-1.html"]}`, { tagIds: [teams], note: "For the talk, the bit about short lists." }, "PATCH");
await api(`/api/v1/items/${hob}`, { tagIds: [kitchen] }, "PATCH");
await api(`/api/v1/items/${tap}`, { tagIds: [kitchen] }, "PATCH");
await api(`/api/v1/items/${ids["blog-1.html"]}`, { status: "later" }, "PATCH");
await api(`/api/v1/items/${todo}`, { tagIds: [teams] }, "PATCH");

const { list } = await api("/api/v1/lists", {
  name: "Kitchen reno, to buy", purpose: "Before the fitters come in December.",
  items: [{ itemId: hob, note: "Check the width against the worktop cut-out." }, { itemId: tap, note: "Brushed steel, not chrome." }],
});
await api(`/api/v1/lists/${list.id}/items/${hob}`, { ticked: true }, "PATCH");
await api("/api/v1/lists", { name: "Best MCP reading", purpose: "Start here. Best first.", items: [{ itemId: ids["news-1.html"] }, { itemId: ids["docs-1.html"] }] });

console.log(JSON.stringify({ email, key, listId: list.id, itemId: ids["news-1.html"], noteId: todo }));
