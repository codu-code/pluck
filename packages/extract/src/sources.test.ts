import { describe, expect, test, vi } from "vitest";

// Canned answers in the shapes each API documents, so this never touches the network.
const answers = vi.hoisted(() => new Map<string, unknown>());
vi.mock("./fetch.ts", async (real) => ({
  ...(await real<typeof import("./fetch.ts")>()),
  guardedFetch: async (url: string) => {
    const key = [...answers.keys()].find((k) => url.startsWith(k));
    if (!key) throw Object.assign(new Error(`HTTP 403 for ${url}`), { status: 403 });
    const v = answers.get(key);
    return { url, contentType: typeof v === "string" ? "text/html" : "application/json", body: Buffer.from(typeof v === "string" ? v : JSON.stringify(v)) };
  },
}));

import { extract } from "./extract.ts";
import { slugTitle, syndicationToken, titleFromText } from "./sources.ts";

describe("sources", () => {
  test("YouTube comes from its oEmbed, never its watch page", async () => {
    answers.set("https://www.youtube.com/oembed", { title: "How lists work", author_name: "Pluck", thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
    answers.set("https://www.youtube.com/watch", "<html><head><title>should not be read</title></head></html>");
    const x = await extract({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(x).toMatchObject({ kind: "video", preview: "player", title: "How lists work", author: "Pluck", coverUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", raw: null, facts: { player: { provider: "youtube", id: "dQw4w9WgXcQ" } } });
  });

  test("a post on X keeps its words from X's oEmbed", async () => {
    answers.set("https://x.com/niall/status/185", "<html><head><title>X</title></head><body>Sign in</body></html>");
    answers.set("https://publish.x.com/oembed", { author_name: "Niall", html: '<blockquote class="twitter-tweet"><p lang="en">Shipping the <a href="#">Archive</a> tonight.</p>&mdash; Niall</blockquote>' });
    const x = await extract({ url: "https://x.com/niall/status/185" });
    expect(x).toMatchObject({ preview: "post", siteName: "X", author: "Niall", markdown: "Shipping the Archive tonight.", facts: { handle: "@niall" }, raw: null });
  });

  test("an X Article is its title and summary, from X's embed JSON, not \"Name (@name) on X\" and a t.co link", async () => {
    // The shape X returned for a real Article post on 26 October 2026, trimmed.
    answers.set("https://x.com/addyosmani/status/2114604912520921136", '<html><head><meta property="og:title" content="Addy Osmani (@addyosmani) on X"></head></html>');
    answers.set("https://cdn.syndication.twimg.com/tweet-result?id=2114604912520921136&", {
      text: "https://t.co/4Hfk0dYIBI",
      user: { name: "Addy Osmani", screen_name: "addyosmani" },
      entities: { urls: [{ url: "https://t.co/4Hfk0dYIBI", expanded_url: "https://x.com/i/article/2114435487905808384", display_url: "x.com/i/article/2114…" }] },
      article: {
        title: "How the Claude Code team does code review ",
        preview_text: "We previously mentioned that Claude writes about 90 percent of the code for Claude Code. So how do we do code review at this scale?",
        cover_media: { media_info: { original_img_url: "https://pbs.twimg.com/media/HVgF5M4bIAAvLxh.jpg" } },
      },
    });
    const x = await extract({ url: "https://x.com/addyosmani/status/2114604912520921136" });
    expect(x).toMatchObject({ preview: "post", siteName: "X", title: "How the Claude Code team does code review", author: "Addy Osmani", coverUrl: "https://pbs.twimg.com/media/HVgF5M4bIAAvLxh.jpg", facts: { handle: "@addyosmani" } });
    expect(x.markdown).toMatch(/^We previously mentioned/);
    expect(x.markdown).not.toContain("t.co");
  });

  test("a post on X: its first line is the title, its links go where they go, the link it shares is kept", async () => {
    answers.set("https://x.com/niall/status/186", "<html></html>");
    answers.set("https://cdn.syndication.twimg.com/tweet-result?id=186&", {
      text: "Wrote up how Pluck reads a link https://t.co/abc https://t.co/pic",
      user: { name: "Niall", screen_name: "niall" },
      entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://getpluck.io/blog/previews", display_url: "getpluck.io/blog/previews" }], media: [{ url: "https://t.co/pic" }] },
      mediaDetails: [{ media_url_https: "https://pbs.twimg.com/media/one.jpg" }],
      card: { url: "https://t.co/abc", binding_values: { title: { string_value: "Previews in Pluck" }, description: { string_value: "Every link as what it is." } } },
    });
    const x = await extract({ url: "https://x.com/niall/status/186" });
    expect(x).toMatchObject({ title: "Wrote up how Pluck reads a link", coverUrl: "https://pbs.twimg.com/media/one.jpg" });
    expect(x.markdown).toBe("Wrote up how Pluck reads a link [getpluck.io/blog/previews](https://getpluck.io/blog/previews)\n\n[Previews in Pluck](https://getpluck.io/blog/previews)\n\nEvery link as what it is.");
    expect(x.excerpt).not.toContain("](");
  });

  test("a post sent from the browser still takes its words from the site's API, not the page around it", async () => {
    answers.set("https://cdn.syndication.twimg.com/tweet-result?id=187&", { text: "Lists over folders.", user: { name: "Niall", screen_name: "niall" } });
    const html = '<html><head><title>(3) Niall on X: "Lists over folders." / X</title><meta property="og:description" content="Home timeline"></head><body><main>Home timeline, who to follow, trends</main></body></html>';
    expect(await extract({ url: "https://x.com/niall/status/187", html })).toMatchObject({ title: "Lists over folders.", markdown: "Lists over folders." });
  });

  test("the token X's embed script sends with an id", () => {
    expect(syndicationToken("20")).toBe(((20 / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ""));
  });

  test("a title from a post's words: its first line with words in it, cut at a word", () => {
    expect(titleFromText("https://example.com/only-a-link\n\nThe real first line")).toBe("The real first line");
    expect(titleFromText("[getpluck.io](https://getpluck.io) is where it lives")).toBe("getpluck.io is where it lives");
    const long = titleFromText("One sentence that keeps going well past the point where a title on a phone would still fit on two lines of text");
    expect(long!.length).toBeLessThanOrEqual(91);
    expect(long).toMatch(/\w…$/);
    expect(titleFromText("https://t.co/4Hfk0dYIBI")).toBeNull();
  });

  test("YouTube's empty page title from the browser gives way to its oEmbed", async () => {
    answers.set("https://www.youtube.com/oembed", { title: "How lists work", author_name: "Pluck" });
    expect(await extract({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", html: "<html><head><title>- YouTube</title></head><body></body></html>" })).toMatchObject({ title: "How lists work" });
  });

  test("Hacker News, Bluesky and Mastodon through their open APIs", async () => {
    answers.set("https://news.ycombinator.com/item", "<html></html>");
    answers.set("https://hacker-news.firebaseio.com/v0/item/41000000.json", { title: "Show HN: Pluck", by: "niall", url: "https://getpluck.io" });
    expect(await extract({ url: "https://news.ycombinator.com/item?id=41000000" })).toMatchObject({ preview: "post", title: "Show HN: Pluck", author: "niall", siteName: "Hacker News", markdown: "https://getpluck.io" });

    answers.set("https://bsky.app/profile/", "<html></html>");
    answers.set("https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread", { thread: { post: { author: { displayName: "Someone", handle: "someone.bsky.social" }, record: { text: "Lists over folders." } } } });
    expect(await extract({ url: "https://bsky.app/profile/someone.bsky.social/post/3kabc" })).toMatchObject({ preview: "post", author: "Someone", markdown: "Lists over folders.", siteName: "Bluesky" });

    answers.set("https://mastodon.social/@someone/112233445566", "<html></html>");
    answers.set("https://mastodon.social/api/v1/statuses/112233445566", { content: "<p>One</p><p>Two</p>", account: { display_name: "Some One", acct: "someone" }, media_attachments: [] });
    expect(await extract({ url: "https://mastodon.social/@someone/112233445566" })).toMatchObject({ preview: "post", author: "Some One", markdown: "One\n\nTwo" });

    // Links stay links: Bluesky's by byte ranges (after an emoji here), Mastodon's anchors; a mention stays words.
    answers.set("https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread", { thread: { post: { author: { handle: "someone.bsky.social" }, record: {
      text: "📚 Read this getpluck.io",
      facets: [{ index: { byteStart: 15, byteEnd: 26 }, features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://getpluck.io" }] }],
    }, embed: { external: { uri: "https://getpluck.io", title: "Pluck", description: "Keep what you find.", thumb: "https://cdn.bsky.app/thumb.jpg" } } } } });
    expect(await extract({ url: "https://bsky.app/profile/someone.bsky.social/post/3kabd" })).toMatchObject({
      title: "📚 Read this getpluck.io", coverUrl: "https://cdn.bsky.app/thumb.jpg",
      markdown: "📚 Read this [getpluck.io](https://getpluck.io)\n\n[Pluck](https://getpluck.io)\n\nKeep what you find.",
    });
    answers.set("https://mastodon.social/api/v1/statuses/112233445567", { content: '<p>Hi <a href="https://mastodon.social/@pluck" class="u-url mention">@pluck</a>, see <a href="https://getpluck.io/lists">getpluck.io/lists</a></p>', account: { acct: "someone" }, media_attachments: [] });
    expect(await extract({ url: "https://mastodon.social/@someone/112233445567" })).toMatchObject({ title: "Hi @pluck, see", markdown: "Hi @pluck, see [getpluck.io/lists](https://getpluck.io/lists)" });
  });

  test("npm, PyPI and Stack Overflow: their bot checks are never fetched", async () => {
    answers.set("https://registry.npmjs.org/@scope%2Fname", { name: "@scope/name", description: "Does a thing.", readme: "# name\n\nDoes a thing well." });
    expect(await extract({ url: "https://www.npmjs.com/package/@scope/name" })).toMatchObject({ preview: "code", title: "@scope/name", excerpt: "Does a thing.", markdown: "# name\n\nDoes a thing well.", facts: { code: "package", handle: "@scope/name" } });

    answers.set("https://pypi.org/pypi/requests/json", { info: { name: "requests", summary: "HTTP for Humans.", description: "Requests is an HTTP library." } });
    expect(await extract({ url: "https://pypi.org/project/requests/" })).toMatchObject({ preview: "code", title: "requests", excerpt: "HTTP for Humans." });

    answers.set("https://api.stackexchange.com/2.3/questions/123", { items: [{ title: "How do I &quot;pluck&quot;?", body: "<p>Asking for a friend.</p>", owner: { display_name: "Q" } }] });
    expect(await extract({ url: "https://stackoverflow.com/questions/123/how-do-i-pluck" })).toMatchObject({ preview: "code", title: 'How do I "pluck"?', markdown: "Asking for a friend.", facts: { code: "question" } });
  });

  test("shells and shops that turn servers away still come out as what they are, from the address", async () => {
    expect(await extract({ url: "https://www.amazon.co.uk/Stoneware-Coffee-Mug-Blue/dp/B000123456" })).toMatchObject({ preview: "product", title: "Stoneware Coffee Mug Blue", siteName: "Amazon" });
    expect(await extract({ url: "https://www.instagram.com/reel/C9xYz/" })).toMatchObject({ preview: "post", kind: "video", siteName: "Instagram" });
    expect(await extract({ url: "https://www.tiktok.com/@someone/video/7400000000000000000" })).toMatchObject({ preview: "player", title: "@someone · TikTok", facts: { vertical: true } });
    expect(await extract({ url: "https://www.reddit.com/r/typescript/comments/abc123/strict_mode_in_five_steps/" })).toMatchObject({ preview: "post", title: "Strict mode in five steps", facts: { handle: "r/typescript" } });
    expect(await extract({ url: "https://claude.ai/public/artifacts/0b4c7f3e" })).toMatchObject({ preview: "app", siteName: "Claude", facts: { app: "claude" } });
  });

  test("what a person's browser sent beats a guess from the address", async () => {
    const x = await extract({ url: "https://www.amazon.co.uk/Stoneware-Coffee-Mug-Blue/dp/B000123456", html: '<html><head><title>Hand-thrown stoneware mug, 350 ml</title><meta property="og:type" content="product"></head><body></body></html>' });
    expect(x).toMatchObject({ preview: "product", title: "Hand-thrown stoneware mug, 350 ml" });
  });

  test("generic titles and share images are dropped; ChatGPT's prefix comes off", async () => {
    answers.set("https://chatgpt.com/share/abc", '<html><head><title>ChatGPT - Planning a week in Kerry</title><meta property="og:image" content="https://cdn.openai.com/chatgpt/share-og.png"></head><body></body></html>');
    expect(await extract({ url: "https://chatgpt.com/share/abc" })).toMatchObject({ preview: "app", title: "Planning a week in Kerry", coverUrl: null, facts: { app: "chatgpt" } });
  });

  test("a PDF sent as plain bytes is still a PDF", async () => {
    answers.set("https://drive.usercontent.google.com/download", "%PDF-1.4 not really a pdf");
    await expect(extract({ url: "https://drive.usercontent.google.com/download?id=1" })).rejects.toThrow(); // read as a PDF (and this one is broken), not as a page
  });

  test("slug titles", () => {
    expect(slugTitle("strict_mode_in_five_steps")).toBe("Strict mode in five steps");
    expect(slugTitle("bird-flu-data-disappears-Ab12Cd34Ef")).toBe("Bird flu data disappears");
    expect(slugTitle("Team-wiki-0123456789abcdef0123456789abcdef")).toBe("Team wiki");
    expect(slugTitle("learning-javascript-properly")).toBe("Learning javascript properly");
    expect(slugTitle("abc123")).toBeNull();
  });
});
