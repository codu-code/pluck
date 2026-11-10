import { beforeEach, expect, test, vi } from "vitest";

// The browser as the background sees it: storage.local, the alarms it has set, the toolbar badge and the page in the tab.
const b = vi.hoisted(() => {
  const b = { local: {} as Record<string, unknown>, alarms: new Set<string>(), made: 0, badge: "", html: "", fetch: (async () => Response.error()) as typeof fetch };
  Object.assign(globalThis, {
    __DEFAULT_SERVER__: "https://pluck.test",
    fetch: ((url, init) => b.fetch(url, init)) as typeof fetch, // the API client keeps the fetch it was made with
    browser: {
      storage: { local: { get: async (k: string) => ({ [k]: b.local[k] }), set: async (patch: object) => void Object.assign(b.local, patch) } },
      alarms: { get: async (name: string) => (b.alarms.has(name) ? { name } : undefined), create: async (name: string) => void (b.alarms.add(name), b.made++) },
      action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async ({ text }: { text: string }) => void (b.badge = text), setIcon: async () => {}, setTitle: async () => {} },
      // The page as rendered; the second script (a video's captions) finds none.
      scripting: { executeScript: async ({ world }: { world?: string }) => [{ result: world ? null : { title: "A page", html: b.html, selection: "" } }] },
    },
  });
  return b;
});
import type { CreateItemBody } from "@pluck/shared-schemas";
import { pluckForPopup, pluckTab, resume } from "./pluck";

beforeEach(() => Object.assign(b, { local: {}, alarms: new Set(), made: 0, badge: "", html: "" }));

// A server that takes every pluck, and what it was sent.
function server() {
  const sent: CreateItemBody[] = [];
  b.local.apiKey = "pk_live_u1";
  b.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string) as CreateItemBody);
    return Response.json({ results: [{ item: { id: "i1", kind: "link", hasCover: true }, created: true }], rejected: [] }, { status: 201 });
  }) as typeof fetch;
  return sent;
}

test("a page too big to send is measured in bytes, not characters: a long one in Japanese is plucked without its HTML", async () => {
  const sent = server();
  b.html = "あ".repeat(1_400_000); // 4.2 MB as sent, though well under four million characters
  expect(await pluckTab({ id: 1, url: "https://a.test/long" })).toMatchObject({ state: "plucked" });
  b.html = "あ".repeat(1_300_000); // 3.9 MB: goes whole
  await pluckTab({ id: 1, url: "https://a.test/shorter" });
  expect(sent.map((s) => [s.url, s.html?.length])).toEqual([["https://a.test/long", undefined], ["https://a.test/shorter", 1_300_000]]);
});

test("a pluck still waiting when the browser comes back gets its alarm and its dot again", async () => {
  b.local.queue = [{ id: "q1", body: { url: "https://a.test" }, at: 1 }];
  await resume(); // the browser restarted, or the extension updated: the alarm is gone
  expect([...b.alarms]).toEqual(["drain"]);
  expect(b.badge).toBe("•");
  await resume(); // the worker only went idle and woke: the alarm is still set, and keeps its minute
  expect(b.made).toBe(1);
});

test("with nothing waiting, starting sets no alarm and shows no dot", async () => {
  await resume();
  expect(b.made).toBe(0);
  expect(b.badge).toBe("");
});

test("the background plucks for the popup, so a popup closed mid-pluck loses nothing: the pluck lands, or waits in the queue", async () => {
  const sent = server();
  const answers: unknown[] = [];
  expect(pluckForPopup({ pluck: { url: "https://a.test/page", title: "A page" } }, null, (o) => void answers.push(o))).toBe(true); // true: the answer comes later
  await vi.waitFor(() => expect(answers).toMatchObject([{ state: "plucked", created: true }]));
  expect(sent).toMatchObject([{ url: "https://a.test/page", title: "A page", source: "extension" }]);

  b.fetch = (async () => { throw new TypeError("offline"); }) as typeof fetch;
  pluckForPopup({ pluck: { url: "https://b.test/page" } }, null, () => {}); // the popup has closed: nobody hears the answer
  await vi.waitFor(() => expect(b.local.queue).toMatchObject([{ body: { url: "https://b.test/page", source: "extension" } }]));
  await vi.waitFor(() => expect(b.badge).toBe("•"));
  expect(pluckForPopup({ somethingElse: true }, null, () => {})).toBeUndefined(); // not a pluck: left to any other listener
});
