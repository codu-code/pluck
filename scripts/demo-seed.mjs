import { readFileSync } from "node:fs";
// Fills a local server with a demo library and prints an API key for it, for screenshots and trying the apps.
// Usage: node scripts/demo-seed.mjs [server] [email] [--store]   (defaults: http://127.0.0.1:3000, demo-ios@example.test)
// --store fills it with the App Store sample library instead (docs/store/app-store.md, the pages in
// packages/extract/fixtures/pages/store), for the store screenshots.
// Needs `pnpm stack` (Mailpit and the fixture pages; PLUCK_FIXTURES points elsewhere) and the app running on that server.
const store = process.argv.includes("--store");
const [server = "http://127.0.0.1:3000", email = store ? "store@example.test" : "demo-ios@example.test"] = process.argv.slice(2).filter((a) => a !== "--store");
const MAILPIT = "http://127.0.0.1:8035";
const FIX = process.env.PLUCK_FIXTURES ?? "http://127.0.0.1:4180";

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
// The email's link is the scanner-safe page (apps/web/lib/signin-link.ts); its button posts the same fields to verify.
const verify = await fetch(link.replace("/signin/link?", "/api/auth/magic-link/verify?"), { redirect: "manual" });
const cookie = verify.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const call = async (path, body, method = "POST", auth = { cookie }) => {
  const res = await fetch(`${server}${path}`, { method, headers: { "content-type": "application/json", origin: server, ...auth }, body: body && JSON.stringify(body) });
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const { key } = await call("/api/v1/api-keys", { name: "iPhone demo" });
const bearer = { authorization: `Bearer ${key}` };
const api = (path, body, method) => call(path, body, method, bearer);

await api("/api/v1/me", { name: store ? "Aoife Byrne" : "Demo Person", handle: `${store ? "aoife" : "demo"}${Date.now().toString(36).slice(-4)}` }, "PATCH");
if (store) {
  console.log(JSON.stringify({ email, key, ...(await storeLibrary()) }));
  process.exit(0);
}
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

// The App Store sample library (docs/store/app-store.md): everyday things, not developer reading.
async function storeLibrary() {
  const tag = async (name) => (await api("/api/v1/tags", { name })).tag.id;
  const t = Object.fromEntries(await Promise.all(["reading", "dinner", "guitar", "lisbon", "kitchen", "home"].map(async (n) => [n, await tag(n)])));
  const link = async (page) => (await api("/api/v1/items", { url: `${FIX}/store/${page}`, source: "ios" })).results[0].item.id;
  // A video is known by its address (a player), so it goes in as the extension sends a page: the address and the HTML,
  // read from the fixture, so nothing is fetched. Its length is in the page.
  const video = async (url, page) => {
    const html = readFileSync(new URL(`../packages/extract/fixtures/pages/store/${page}`, import.meta.url), "utf8");
    return (await api("/api/v1/items", { url, html, source: "ios" })).results[0].item.id;
  };
  const text = async (body, kind, dueAt) => (await api("/api/v1/items", { text: body, kind, ...(dueAt ? { dueAt } : {}) })).results[0].item.id;
  const patch = (id, body) => api(`/api/v1/items/${id}`, body, "PATCH");
  // A picture and a PDF arrive as files, as the share sheet sends them: the Item, then the bytes to its upload URL.
  const file = async (path, name, contentType) => {
    const bytes = readFileSync(new URL(`../packages/extract/fixtures/pages/store/${path}`, import.meta.url));
    const { item, uploadUrl } = await api("/api/v1/items/files", { name, contentType, size: bytes.length, source: "ios" });
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
    if (!put.ok) throw new Error(`upload ${name}: ${put.status}`);
    return item.id;
  };
  const friday = new Date(); friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7)); friday.setHours(9, 0, 0, 0);

  // Oldest first, so the Inbox reads newest first as it would after a week of plucking.
  const places = {};
  for (const p of ["market.html", "miradouro.html", "pasteis.html", "azulejo.html", "lxfactory.html", "tram.html"]) places[p] = await link(p);
  const pdf = await file("lisbon-in-three-days.pdf", "Lisbon in three days.pdf", "application/pdf");
  const duvet = await link("duvet.html");
  const kitchen = await file("green-kitchen-oak-shelves.png", "Green kitchen, oak shelves.png", "image/png");
  const rest = await link("rest.html");
  const guitar = await video("https://www.youtube.com/watch?v=Gtr4Grwnup1", "guitar.html");
  const dad = await text("Ask Dad about the boat\nWhether it can go out in May, and who has the keys.", "note");
  const dentist = await text("Book the dentist", "todo", friday.toISOString());
  const noodles = await video("https://www.tiktok.com/@halfpastsix/video/7400000000000000001", "noodles.html");
  const habits = await link("habits.html");

  await patch(habits, { tagIds: [t.reading] });
  await patch(rest, { tagIds: [t.reading], status: "later" });
  await patch(noodles, { tagIds: [t.dinner] });
  await patch(guitar, { tagIds: [t.guitar] });
  await patch(pdf, { tagIds: [t.lisbon] });
  await patch(kitchen, { tagIds: [t.kitchen], note: "The shelves, not the colour. Ask Dad if oak works over the hob." });
  await patch(duvet, { tagIds: [t.home] });
  const quote = "Small is not the warm-up for the real habit. Small is the habit.";
  await api("/api/v1/highlights", { itemId: habits, quote, selector: { textQuote: { exact: quote, prefix: "", suffix: "" }, textPosition: { start: 0, end: quote.length } } });

  // Lisbon, May: six places with a note each, the first two ticked. They were plucked a while ago, so the Archive has them.
  const notes = ["Lunch on the first day.", "For the last evening.", "Before the tram, not after.", "Closed Mondays.", "Sunday morning, then the bookshop.", "Before nine or not at all."];
  const { list } = await api("/api/v1/lists", {
    name: "Lisbon, May", purpose: "Six places, in the order we want them.",
    items: Object.values(places).map((itemId, i) => ({ itemId, note: notes[i] })),
  });
  for (const id of Object.values(places).slice(0, 2)) await api(`/api/v1/lists/${list.id}/items/${id}`, { ticked: true }, "PATCH");
  await api("/api/v1/items/batch", { itemIds: Object.values(places), patch: { status: "archived" } });
  await api(`/api/v1/lists/${list.id}/items`, { itemId: pdf, note: "Print it for the plane." });
  return { listId: list.id, itemId: habits, noteId: dad, todoId: dentist, kitchenId: kitchen };
}
