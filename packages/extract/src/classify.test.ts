import { playerSrc } from "@pluck/shared-schemas";
import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { fromAddress, fromPage, isoSeconds } from "./classify.ts";
import { extractFromHtml } from "./extract.ts";

describe("fromAddress", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "player", "video", { player: { provider: "youtube", id: "dQw4w9WgXcQ" } }],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "player", "video", { player: { provider: "youtube", id: "dQw4w9WgXcQ" } }],
    ["https://youtube.com/shorts/aBcDeFgHiJk", "player", "video", { player: { provider: "youtube", id: "aBcDeFgHiJk" }, vertical: true }],
    ["https://m.youtube.com/live/aBcDeFgHiJk", "player", "video", { player: { provider: "youtube", id: "aBcDeFgHiJk" } }],
    ["https://vimeo.com/76979871", "player", "video", { player: { provider: "vimeo", id: "76979871" } }],
    ["https://vimeo.com/channels/staffpicks/76979871", "player", "video", { player: { provider: "vimeo", id: "76979871" } }],
    ["https://www.loom.com/share/0123456789abcdef0123456789abcdef", "player", "video", { player: { provider: "loom", id: "0123456789abcdef0123456789abcdef" } }],
    ["https://open.spotify.com/intl-de/episode/4rOoJ6Egrf8K2IrywzwOMk", "player", "link", { player: { provider: "spotify", id: "episode/4rOoJ6Egrf8K2IrywzwOMk" } }],
    ["https://x.com/niall/status/1850000000000000000", "post", "link", { handle: "@niall" }],
    ["https://twitter.com/niall/status/1850000000000000000/photo/1", "post", "link", { handle: "@niall" }],
    ["https://www.reddit.com/r/typescript/comments/abc123/strict_mode/", "post", "link", { handle: "r/typescript" }],
    ["https://www.instagram.com/reel/C9xYz/", "player", "video", { player: { provider: "instagram", id: "C9xYz" }, vertical: true }],
    ["https://www.instagram.com/rj.bernaldo/reel/De6Q_cyzWLC/", "player", "video", { player: { provider: "instagram", id: "De6Q_cyzWLC" }, handle: "@rj.bernaldo", vertical: true }],
    ["https://www.instagram.com/p/C9xYz/", "post", "link", {}],
    ["https://www.instagram.com/someone/p/C9xYz/", "post", "link", { handle: "@someone" }],
    ["https://www.tiktok.com/@someone/video/7400000000000000000", "player", "video", { player: { provider: "tiktok", id: "7400000000000000000" }, handle: "@someone", vertical: true }],
    ["https://claude.ai/share/0b4c7f3e-1", "app", undefined, { app: "claude-chat" }],
    ["https://bsky.app/profile/someone.bsky.social/post/3kabc", "post", "link", { handle: "@someone.bsky.social" }],
    ["https://mastodon.social/@someone/112233445566", "post", "link", { handle: "@someone" }],
    ["https://news.ycombinator.com/item?id=41000000", "post", "link", {}],
    ["https://github.com/codu-code/pluck", "code", undefined, { code: "repo", handle: "codu-code/pluck" }],
    ["https://github.com/codu-code/pluck/issues/12", "code", undefined, { code: "issue", handle: "codu-code/pluck" }],
    ["https://github.com/codu-code/pluck/pull/78", "code", undefined, { code: "pull", handle: "codu-code/pluck" }],
    ["https://gitlab.com/group/project/-/merge_requests/5", "code", undefined, { code: "pull", handle: "group/project" }],
    ["https://gist.github.com/someone/abc123", "code", undefined, { code: "gist", handle: "someone" }],
    ["https://www.npmjs.com/package/@scope/name", "code", undefined, { code: "package", handle: "@scope/name" }],
    ["https://stackoverflow.com/questions/123/how-to", "code", undefined, { code: "question" }],
    ["https://claude.ai/public/artifacts/0b4c7f3e-1", "app", undefined, { app: "claude" }],
    ["https://chatgpt.com/share/68abc-1", "app", undefined, { app: "chatgpt" }],
    ["https://www.figma.com/design/AbC123/Board", "app", undefined, { app: "figma" }],
    ["https://docs.google.com/document/d/1abc/edit", "app", undefined, { app: "google-docs" }],
  ])("%s", (url, preview, kind, facts) => {
    const g = fromAddress(url)!;
    expect(g.preview).toBe(preview);
    expect(g.kind).toBe(kind);
    expect(g.facts).toEqual(facts);
  });

  test.each([
    "https://example.com/blog/a-post",
    "https://github.com/features/copilot",
    "https://github.com/codu-code", // an owner, not a repo
    "https://www.reddit.com/r/typescript/", // a subreddit is a site of its own
    "https://claude.ai/new", // the app itself, not something shared from it
    "https://www.youtube.com/@channel",
    "not a url",
  ])("%s is left to the page", (url) => expect(fromAddress(url)).toBeNull());

  test("only ids the player allows become a player address", () => {
    expect(playerSrc({ player: { provider: "youtube", id: "dQw4w9WgXcQ" } })).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1");
    expect(playerSrc({ player: { provider: "youtube", id: "x\"><script>" } })).toBeNull();
    expect(playerSrc({})).toBeNull();
  });
});

const page = (head: string, body = "<p>Hello.</p>") => parseHTML(`<html><head>${head}</head><body>${body}</body></html>`).document as unknown as Document;
const ld = (v: unknown) => `<script type="application/ld+json">${JSON.stringify(v)}</script>`;
const words = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `word${i}`).join(" ")}</p>`;

describe("fromPage", () => {
  test("a product, with its price from Open Graph or schema.org", () => {
    expect(fromPage(page('<meta property="og:type" content="product"><meta property="product:price:amount" content="24,99"><meta property="product:price:currency" content="eur">'), "https://shop.test/p/mug", 200))
      .toEqual({ preview: "product", facts: { price: { amount: 24.99, currency: "EUR" } } });
    expect(fromPage(page(ld({ "@context": "https://schema.org", "@graph": [{ "@type": "Product", name: "Mug", offers: { "@type": "Offer", price: "12.00", priceCurrency: "GBP" } }] })), "https://shop.test/p/mug", 200))
      .toEqual({ preview: "product", facts: { price: { amount: 12, currency: "GBP" } } });
  });
  test("a paper's landing page names its PDF", () => {
    expect(fromPage(page('<meta name="citation_pdf_url" content="/pdf/2401.00001">'), "https://arxiv.org/abs/2401.00001", 150))
      .toEqual({ preview: "document", facts: { pdfUrl: "https://arxiv.org/pdf/2401.00001" } });
  });
  test("an article says so, even at a site's root", () => {
    expect(fromPage(page(ld({ "@type": "BlogPosting", headline: "Hi" })), "https://blog.test/", 400).preview).toBe("reader");
  });
  test("a homepage, in any language, and a page with nothing to read", () => {
    expect(fromPage(page('<meta property="og:type" content="website">'), "https://acme.test/", 600).preview).toBe("site");
    expect(fromPage(page(""), "https://acme.test/de-de/", 600).preview).toBe("site");
    expect(fromPage(page(""), "https://app.test/dashboard", 4).preview).toBe("site");
    expect(fromPage(page(""), "https://blog.test/posts/hello", 400).preview).toBe("reader");
  });
  test("durations", () => {
    expect(isoSeconds("PT1H2M3S")).toBe(3723);
    expect(isoSeconds("PT12M")).toBe(720);
    expect(isoSeconds("P")).toBeUndefined();
    expect(isoSeconds("12 minutes")).toBeUndefined();
  });
});

describe("what is kept", () => {
  test("a homepage keeps what it says it is, not its page furniture or its HTML", async () => {
    const x = await extractFromHtml(`<html><head><title>Acme</title><meta name="description" content="Invoices that send themselves."></head><body><nav>Pricing Docs Login</nav>${words(300)}</body></html>`, "https://acme.test/");
    expect(x.preview).toBe("site");
    expect(x.markdown).toBe("Invoices that send themselves.");
    expect(x.raw).toBeNull();
  });
  test("a post keeps its description, never the sign-in wall around it", async () => {
    const x = await extractFromHtml(`<html><head><meta property="og:title" content="Niall on X"><meta property="og:description" content="Shipping the Archive tonight."></head><body><h1>Sign in to X</h1>${words(120)}</body></html>`, "https://x.com/niall/status/1850000000000000000");
    expect(x).toMatchObject({ preview: "post", kind: "link", markdown: "Shipping the Archive tonight.", facts: { handle: "@niall" }, raw: null });
  });
  test("an article keeps its body and its page", async () => {
    const x = await extractFromHtml(`<html><head><title>On lists</title><meta property="og:type" content="article"></head><body><article><h1>On lists</h1>${words(400)}</article></body></html>`, "https://blog.test/posts/lists");
    expect(x.preview).toBe("reader");
    expect(x.wordCount).toBeGreaterThan(350);
    expect(x.raw).not.toBeNull();
  });
  test("a video page knows its length", async () => {
    const x = await extractFromHtml(`<html><head><meta itemprop="duration" content="PT4M13S"><meta property="og:title" content="A video"></head><body></body></html>`, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(x).toMatchObject({ kind: "video", preview: "player", facts: { player: { provider: "youtube", id: "dQw4w9WgXcQ" }, seconds: 253 } });
  });
});
