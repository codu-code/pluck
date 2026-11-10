import { hitRateLimit } from "@pluck/db";
import { beforeAll, expect, test, vi } from "vitest";
import manifest from "@/app/manifest";
import { auth, signInCode } from "@/lib/auth";
import { browse } from "@/lib/library";
import { samePath } from "@/lib/same-site";
import { GET } from "./route";

// after() only works inside a request Next is serving; here the work it would put off is simply not done.
vi.mock("next/server", async (real) => ({ ...(await real<typeof import("next/server")>()), after: () => {} }));

const BASE = process.env.BETTER_AUTH_URL!;
const FIX = "http://127.0.0.1:4180";
let me: { id: string; cookie: string };

beforeAll(async () => {
  const email = `share-${Date.now()}@example.test`;
  const res = await auth.handler(new Request(`${BASE}/api/auth/sign-in/email-otp`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, otp: await signInCode(email) }),
  }));
  me = { id: ((await res.json()) as { user: { id: string } }).user.id, cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
});

// A share as the browser sends it: `site` is Sec-Fetch-Site, "none" when the browser itself started the navigation.
const share = (shared: Record<string, string>, site: string | null, cookie: string | null = me.cookie) =>
  GET(new Request(`${BASE}/share?${new URLSearchParams(shared)}`, { headers: { ...(site ? { "sec-fetch-site": site } : {}), ...(cookie ? { cookie } : {}) } }), { params: Promise.resolve({}) });
const inbox = async () => (await browse(me.id, { status: "inbox", sort: "newest", limit: 50 })).items;
const add = (text: string) => `${BASE}/share/add?${new URLSearchParams({ text })}`;

test("the manifest offers Pluck to Android's Share, with the title, text and link", () => {
  expect(manifest().share_target).toEqual({ action: "/share", method: "GET", params: { title: "title", text: "text", url: "url" } });
});

test("signed in, a share the browser started is plucked like a paste, then lands on the Inbox", async () => {
  // Android's usual shape: the link inside the text.
  const inText = await share({ title: "Worth a read", text: `Worth a read ${FIX}/news-1.html` }, "none");
  expect([inText.status, inText.headers.get("location")]).toEqual([303, `${BASE}/inbox`]);
  expect((await inbox()).map((i) => [i.url, i.source])).toEqual([[`${FIX}/news-1.html`, "web"]]);

  // Sometimes it is in `url`, with words beside it.
  expect((await share({ title: "A blog", text: "Read this one", url: `${FIX}/blog-1.html` }, "none")).headers.get("location")).toBe(`${BASE}/inbox`);
  expect((await inbox()).map((i) => i.url)).toEqual([`${FIX}/blog-1.html`, `${FIX}/news-1.html`]);

  // No link at all: a Note, as pasting the words would make.
  await share({ title: "Kitchen", text: "Measure the worktop cut-out twice." }, "none");
  expect((await inbox())[0]).toMatchObject({ kind: "note", title: "Measure the worktop cut-out twice.", url: null, source: "web" });

  // Nothing shared: nothing plucked.
  expect((await share({}, "none")).headers.get("location")).toBe(`${BASE}/inbox`);
  expect(await inbox()).toHaveLength(3);
});

test("a link to /share from a page, or from anything that is not the browser itself, plucks nothing: it lands on the box holding the link", async () => {
  const before = (await inbox()).length;
  const text = `${FIX}/news-2.html`;
  for (const site of ["cross-site", "same-site", "same-origin", null]) {
    const res = await share({ text }, site);
    expect([site, res.status, res.headers.get("location")]).toEqual([site, 303, add(text)]);
  }
  expect(await inbox()).toHaveLength(before);
});

test("a share the library refuses lands on the box too, where pressing Pluck it says why", async () => {
  const before = (await inbox()).length;
  await hitRateLimit(`links:${me.id}`, Infinity, 3600, 2000); // the hour's links are spent
  const text = `${FIX}/news-3.html`;
  expect((await share({ text }, "none")).headers.get("location")).toBe(add(text));
  expect(await inbox()).toHaveLength(before);
});

test("signed out, a share goes to sign-in and comes back to the box with every word it had", async () => {
  const text = `"Quoted" *starred* back\\slash & more\n${FIX}/news-4.html?a=1&b=2#top`;
  const res = await share({ text }, "none", null);
  const to = new URL(res.headers.get("location")!);
  expect([res.status, to.origin + to.pathname]).toEqual([303, `${BASE}/signin`]);
  const next = to.searchParams.get("next")!;
  expect(samePath(next, "/inbox")).toBe(next); // the sign-in page takes it as a way back
  expect(BASE + next).toBe(add(text));
  expect(new URL(next, BASE).searchParams.get("text")).toBe(text);
  // And so does the sign-in email: its link is made to come back here.
  const sent = await auth.handler(new Request(`${BASE}/api/auth/sign-in/magic-link`, {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.77" }, body: JSON.stringify({ email: `back-${Date.now()}@example.test`, callbackURL: next }),
  }));
  expect(sent.status).toBe(200);
});
