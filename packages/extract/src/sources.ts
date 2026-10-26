import type { Facts, Preview } from "@pluck/shared-schemas";
import { parseHTML } from "linkedom";
import { guardedFetch, PLUCK_UA } from "./fetch.ts";

// Sites whose own pages are no use to a server (an app shell, a sign-in wall, a bot check, terms that forbid
// reading the page) and the documented, tokenless ways each one says what a link is. Researched October 2026:
// see docs/previews.md for each source, what it returns and the terms that bind it.

export type Found = {
  title?: string | null;
  author?: string | null;
  siteName?: string | null;
  excerpt?: string | null;
  coverUrl?: string | null;
  markdown?: string; // the words worth keeping: a post's text, a package's README, a question
  preview?: Preview;
  kind?: "link" | "video";
  facts?: Facts;
};

type Source = {
  match: (u: URL) => boolean;
  // Never fetch the page itself: it is a shell, a bot check, or its terms say no. What the person's browser sent
  // (the extension, the share sheet in Safari) is still read.
  only?: boolean;
  resolve?: (u: URL, signal?: AbortSignal) => Promise<Found | null>;
};

const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m|mobile|old)\./, "");
const parts = (u: URL) => u.pathname.split("/").filter(Boolean);
const clean = (s: unknown) => (typeof s === "string" && s.replace(/\s+/g, " ").trim()) || null;

async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await guardedFetch(url, { signal, accept: "application/json", userAgent: PLUCK_UA, maxBytes: 2_000_000 });
  return JSON.parse(res.body.toString("utf8")) as T;
}

// HTML from an API (a post body, a README) as plain paragraphs, its links kept as [words](address) so they stay
// links; a mention or a hashtag stays words.
function textOf(html: string | null | undefined): string {
  if (!html) return "";
  const { document } = parseHTML(`<div>${html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h\d|pre|blockquote)>/gi, "$&\n\n")}</div>`);
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    const words = a.textContent?.trim() ?? "";
    if (/^https?:\/\//.test(href) && words && !/\b(mention|hashtag)\b/.test(a.getAttribute("class") ?? "") && !/^[#@]/.test(words)) a.replaceWith(`[${words}](${href})`);
  }
  return (document.querySelector("div")?.textContent ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// [words](address) as the words, for a title or an excerpt.
const plain = (md: string) => md.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

// A post's title is what it says, its first line that is more than an address, not who said it ("Addy Osmani
// (@addyosmani) on X"). Long lines stop at a word, about 90 characters in.
export function titleFromText(text: string | null | undefined, max = 90): string | null {
  // An address in the words is no title: bare ones go, and so does a link's label at the end when it is a path.
  const line = plain(text ?? "").split("\n")
    .map((l) => l.replace(/https?:\/\/\S+/g, "").replace(/\s[\w.-]+\.[a-z]{2,}\/\S*\s*$/i, "").replace(/\s+/g, " ").trim())
    .find((l) => /[\p{L}\p{N}]/u.test(l));
  if (!line) return null;
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

// The link a post shares, shown under its words: [its title](its address) and a line of what it says.
const shared = (l: { url?: string | null; title?: string | null; description?: string | null }) =>
  l.url ? [`[${clean(l.title) ?? l.url}](${l.url})`, clean(l.description)].filter(Boolean).join("\n\n") : "";
const joined = (...blocks: (string | null | undefined)[]) => blocks.map((b) => b?.trim()).filter(Boolean).join("\n\n");

// A post as an Item: its words (with its links), a title from them, an excerpt without the link syntax.
function postOf(markdown: string, more: Found = {}): Found {
  const md = markdown.trim();
  return { title: titleFromText(md), ...(md ? { markdown: md, excerpt: plain(md).slice(0, 400) } : {}), ...more };
}

// "strict_mode_in_5_steps" or "bird-flu-data-disappears-Ab12" as words, for links whose pages hide their titles.
export function slugTitle(slug: string | undefined): string | null {
  if (!slug) return null;
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // kept as it is
  }
  const words = s.replace(/[-_]+/g, " ").replace(/\b[0-9a-f]{32}\b|\s(?=[A-Za-z.]*\d)[A-Za-z0-9.]{8,}$/, "").trim();
  if (!/[a-z]/i.test(words) || words.split(" ").length < 2) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string; description?: string; duration?: number; html?: string };
const oembed = (endpoint: string, u: URL, signal?: AbortSignal) => json<OEmbed>(`${endpoint}${endpoint.includes("?") ? "&" : "?"}url=${encodeURIComponent(u.toString())}`, signal);

const fromOEmbed = (o: OEmbed): Found => ({
  title: clean(o.title), author: clean(o.author_name), coverUrl: clean(o.thumbnail_url),
  ...(o.description ? { excerpt: clean(o.description)!.slice(0, 400), markdown: o.description.trim() } : {}),
  ...(o.duration ? { facts: { seconds: Math.round(o.duration) } } : {}),
});

// ---- X's embed JSON -----------------------------------------------------------------------------------------

type XLink = { url: string; expanded_url?: string; display_url?: string };
type Syndicated = {
  text?: string;
  user?: { name?: string; screen_name?: string };
  entities?: { urls?: XLink[]; media?: XLink[] };
  mediaDetails?: { media_url_https?: string }[];
  article?: { title?: string; preview_text?: string; cover_media?: { media_info?: { original_img_url?: string } } };
  card?: { url?: string; binding_values?: Record<string, { string_value?: string; image_value?: { url?: string } }> };
  quoted_tweet?: Syndicated;
};

// The token X's embed script sends with each id (react-tweet does the same sum).
export const syndicationToken = (id: string) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");

// A post's words with each t.co link as [x.com/…](where it goes), its picture links dropped (the pictures are kept),
// and the link to an X Article dropped when the Article is what it carries.
function xText(p: Syndicated): string {
  let text = p.text ?? "";
  for (const m of p.entities?.media ?? []) text = text.replace(m.url, "");
  for (const l of p.entities?.urls ?? []) {
    const to = l.expanded_url ?? l.url;
    text = text.replace(l.url, p.article && /\/i\/article\//.test(to) ? "" : `[${l.display_url ?? to}](${to})`);
  }
  return text.trim();
}

function fromSyndication(p: Syndicated): Found {
  const handle = p.user?.screen_name ? `@${p.user.screen_name}` : null;
  const v = p.card?.binding_values ?? {};
  const cardUrl = p.entities?.urls?.find((l) => l.url === (v.card_url?.string_value ?? p.card?.url))?.expanded_url ?? null;
  const card = v.title?.string_value && cardUrl ? shared({ url: cardUrl, title: v.title.string_value, description: v.description?.string_value }) : "";
  const quoted = p.quoted_tweet ? xText(p.quoted_tweet).split("\n").map((l) => `> ${l}`).join("\n") : "";
  const cover = p.article?.cover_media?.media_info?.original_img_url ?? p.mediaDetails?.[0]?.media_url_https ?? v.thumbnail_image_large?.image_value?.url ?? null;
  const base = { siteName: "X", author: clean(p.user?.name), coverUrl: cover, ...(handle ? { facts: { handle } } : {}) };
  if (p.article?.title) {
    // An X Article: its title and summary are what can be read without signing in.
    const summary = clean(p.article.preview_text);
    return { ...base, facts: { ...base.facts, article: true }, title: clean(p.article.title), ...(summary ? { markdown: joined(xText(p), p.article.preview_text), excerpt: summary.slice(0, 400) } : {}) };
  }
  const found = postOf(joined(xText(p), card, quoted), base);
  return { ...found, title: found.title ?? clean(v.title?.string_value) };
}

// ---- Bluesky -------------------------------------------------------------------------------------------------

type BskyEmbed = { images?: { fullsize?: string }[]; external?: { uri?: string; title?: string; description?: string; thumb?: string } };
type BskyPost = {
  author?: { displayName?: string; handle?: string };
  record?: { text?: string; facets?: { index?: { byteStart: number; byteEnd: number }; features?: { $type?: string; uri?: string }[] }[] };
  embed?: BskyEmbed & { media?: BskyEmbed };
};

// Bluesky marks links in a post by byte ranges of its UTF-8 text; each becomes [words](address).
function bskyText(r: BskyPost["record"]): string {
  const bytes = Buffer.from(r?.text ?? "", "utf8");
  const links = (r?.facets ?? [])
    .map((f) => ({ ...f.index!, uri: f.features?.find((x) => x.$type === "app.bsky.richtext.facet#link")?.uri }))
    .filter((f) => f.uri && f.byteStart >= 0 && f.byteEnd <= bytes.length && f.byteStart < f.byteEnd)
    .sort((a, b) => a.byteStart - b.byteStart);
  let out = "";
  let at = 0;
  for (const l of links) {
    if (l.byteStart < at) continue;
    out += bytes.subarray(at, l.byteStart).toString("utf8") + `[${bytes.subarray(l.byteStart, l.byteEnd).toString("utf8")}](${l.uri})`;
    at = l.byteEnd;
  }
  return (out + bytes.subarray(at).toString("utf8")).trim();
}

const SOURCES: Source[] = [
  // YouTube's terms rule out reading the watch page; its oEmbed is the sanctioned way to a title and thumbnail.
  { match: (u) => /^(youtube\.com|youtu\.be|music\.youtube\.com)$/.test(host(u)), only: true, resolve: async (u, signal) => fromOEmbed(await oembed("https://www.youtube.com/oembed?format=json", u, signal)) },
  { match: (u) => host(u) === "vimeo.com", resolve: async (u, signal) => fromOEmbed(await oembed("https://vimeo.com/api/oembed.json", u, signal)) },
  { match: (u) => host(u) === "loom.com", only: true, resolve: async (u, signal) => fromOEmbed(await oembed("https://www.loom.com/v1/oembed", u, signal)) },
  { match: (u) => host(u) === "open.spotify.com", only: true, resolve: async (u, signal) => ({ ...fromOEmbed(await oembed("https://open.spotify.com/oembed", u, signal)), siteName: "Spotify" }) },

  // App shells with nothing to read and no API that may be kept from: the address says what it is.
  { match: (u) => host(u) === "tiktok.com", only: true, resolve: async (u) => ({ siteName: "TikTok", title: parts(u)[0]?.startsWith("@") ? `${parts(u)[0]} · TikTok` : null }) },
  { match: (u) => host(u) === "instagram.com", only: true, resolve: async () => ({ siteName: "Instagram" }) },
  { match: (u) => /^threads\.(net|com)$/.test(host(u)), only: true, resolve: async (u) => ({ siteName: "Threads", title: parts(u)[0]?.startsWith("@") ? `${parts(u)[0]} · Threads` : null }) },
  { match: (u) => host(u) === "facebook.com", only: true, resolve: async () => ({ siteName: "Facebook" }) },

  // X: the JSON its own embed widget reads (cdn.syndication.twimg.com, as react-tweet does) has the post with its links
  // expanded, its pictures, the card of a link it shares, and an X Article's title and summary (the article itself is
  // only shown to people signed in). Not documented, so X's documented oEmbed is the fallback.
  {
    match: (u) => /^(x\.com|twitter\.com)$/.test(host(u)) && parts(u)[1] === "status",
    resolve: async (u, signal) => {
      const id = parts(u)[2] ?? "";
      const embed = /^\d{1,20}$/.test(id) ? await json<Syndicated>(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}&lang=en`, signal).catch(() => null) : null;
      if (embed?.text !== undefined || embed?.article) return fromSyndication(embed);
      const o = await oembed("https://publish.x.com/oembed?omit_script=1&dnt=true", u, signal);
      return postOf(textOf(/<p[^>]*>([\s\S]*?)<\/p>/.exec(o.html ?? "")?.[1]), { siteName: "X", author: clean(o.author_name) });
    },
  },
  {
    match: (u) => host(u) === "reddit.com" || host(u) === "redd.it",
    only: true, // the page is a shell and .json is not an allowed route; Reddit's oEmbed is
    resolve: async (u, signal) => {
      const p = parts(u);
      const o = p[2] === "comments" ? await oembed("https://www.reddit.com/oembed", u, signal).catch(() => ({}) as OEmbed) : ({} as OEmbed);
      return { siteName: "Reddit", title: clean(o.title) ?? slugTitle(p[4]) ?? (p[0] === "r" && p[1] ? `r/${p[1]}` : null), author: o.author_name ? `u/${o.author_name}` : null };
    },
  },
  {
    match: (u) => host(u) === "news.ycombinator.com" && parts(u)[0] === "item" && /^\d+$/.test(u.searchParams.get("id") ?? ""),
    resolve: async (u, signal) => {
      const it = await json<{ title?: string; by?: string; text?: string; url?: string }>(`https://hacker-news.firebaseio.com/v0/item/${u.searchParams.get("id")}.json`, signal);
      const text = [textOf(it.text), it.url ?? ""].filter(Boolean).join("\n\n");
      return { siteName: "Hacker News", title: clean(it.title), author: clean(it.by), facts: it.by ? { handle: it.by } : {}, markdown: text, excerpt: text.slice(0, 400) || null };
    },
  },
  {
    match: (u) => host(u) === "bsky.app" && parts(u)[0] === "profile" && parts(u)[2] === "post",
    resolve: async (u, signal) => {
      const [, who, , rkey] = parts(u);
      const t = await json<{ thread?: { post?: BskyPost } }>(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(`at://${who}/app.bsky.feed.post/${rkey}`)}&depth=0`, signal);
      const post = t.thread?.post;
      const embed = post?.embed?.media ?? post?.embed;
      const card = post?.embed?.external ?? post?.embed?.media?.external;
      return postOf(joined(bskyText(post?.record), card && shared({ url: card.uri, title: card.title, description: card.description })), {
        siteName: "Bluesky",
        author: clean(post?.author?.displayName) ?? post?.author?.handle ?? null,
        coverUrl: embed?.images?.[0]?.fullsize ?? card?.thumb ?? null,
      });
    },
  },
  {
    // Mastodon and its kin, on any server: /@name/123456. Public posts answer without signing in.
    match: (u) => /^@[\w.]+$/.test(parts(u)[0] ?? "") && /^\d{6,}$/.test(parts(u)[1] ?? "") && !/^(tiktok\.com|threads\.(net|com))$/.test(host(u)),
    resolve: async (u, signal) => {
      const s = await json<{ content?: string; account?: { display_name?: string; acct?: string }; media_attachments?: { type?: string; url?: string; preview_url?: string }[]; card?: { url?: string; title?: string; description?: string; image?: string | null } | null }>(`${u.origin}/api/v1/statuses/${parts(u)[1]}`, signal);
      const image = s.media_attachments?.find((m) => m.type === "image");
      return postOf(joined(textOf(s.content), s.card && shared(s.card)), { author: clean(s.account?.display_name) ?? s.account?.acct ?? null, coverUrl: image?.preview_url ?? image?.url ?? s.card?.image ?? null });
    },
  },

  // Registries and Q&A behind bot checks, each with an open API.
  {
    match: (u) => host(u) === "npmjs.com" && parts(u)[0] === "package",
    only: true,
    resolve: async (u, signal) => {
      const name = parts(u).slice(1, parts(u)[1]?.startsWith("@") ? 3 : 2).join("/");
      const p = await json<{ name?: string; description?: string; readme?: string; "dist-tags"?: { latest?: string } }>(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, signal);
      return { siteName: "npm", title: p.name ?? name, excerpt: clean(p.description), markdown: p.readme?.trim() || p.description || "", facts: { code: "package", handle: name } };
    },
  },
  {
    match: (u) => host(u) === "pypi.org" && parts(u)[0] === "project" && Boolean(parts(u)[1]),
    only: true,
    resolve: async (u, signal) => {
      const p = await json<{ info?: { name?: string; summary?: string; description?: string; author?: string } }>(`https://pypi.org/pypi/${encodeURIComponent(parts(u)[1]!)}/json`, signal);
      return { siteName: "PyPI", title: p.info?.name ?? parts(u)[1], author: clean(p.info?.author), excerpt: clean(p.info?.summary), markdown: p.info?.description?.trim() || p.info?.summary || "", facts: { code: "package", handle: parts(u)[1] } };
    },
  },
  {
    match: (u) => /^(stackoverflow\.com|superuser\.com|serverfault\.com|askubuntu\.com|([a-z]+\.)?stackexchange\.com)$/.test(host(u)) && parts(u)[0] === "questions" && /^\d+$/.test(parts(u)[1] ?? ""),
    only: true,
    resolve: async (u, signal) => {
      const site = host(u).replace(/\.com$/, "");
      const r = await json<{ items?: { title?: string; body?: string; owner?: { display_name?: string }; tags?: string[] }[] }>(`https://api.stackexchange.com/2.3/questions/${parts(u)[1]}?site=${site}&filter=withbody`, signal);
      const q = r.items?.[0];
      const text = textOf(q?.body);
      return { siteName: "Stack Overflow", title: q?.title ? textOf(q.title) : slugTitle(parts(u)[2]), author: clean(q?.owner?.display_name), ...(text ? { markdown: text, excerpt: text.slice(0, 400) } : {}), facts: { code: "question" } };
    },
  },
  {
    // A repo's language and stars (the page gives the rest). Sixty calls an hour per server, so it may say nothing.
    match: (u) => host(u) === "github.com" && parts(u).length === 2,
    resolve: async (u, signal) => {
      const [o, r] = parts(u);
      const repo = await json<{ language?: string | null; stargazers_count?: number }>(`https://api.github.com/repos/${o}/${r}`, signal);
      return { facts: { code: "repo", handle: `${o}/${r}`, ...(repo.language ? { language: repo.language } : {}), ...(typeof repo.stargazers_count === "number" ? { stars: repo.stargazers_count } : {}) } };
    },
  },

  // Shops that turn servers away: the address names the product.
  { match: (u) => /^amazon\.[a-z.]+$/.test(host(u)) && /\/(dp|gp\/product)\//.test(u.pathname), only: true, resolve: async (u) => ({ siteName: "Amazon", title: slugTitle(parts(u)[parts(u).indexOf("dp") - 1]), preview: "product" }) },

  // AI and doc links whose pages are shells with generic tags.
  { match: (u) => host(u) === "claude.ai" && /^\/(share|public\/artifacts)\//.test(u.pathname), only: true, resolve: async () => ({ siteName: "Claude" }) },
  { match: (u) => /^(gemini\.google\.com|g\.co)$/.test(host(u)), only: true, resolve: async () => ({ siteName: "Gemini" }) },
  { match: (u) => host(u) === "perplexity.ai" && /^\/(page|search)\//.test(u.pathname), only: true, resolve: async (u) => ({ siteName: "Perplexity", title: slugTitle(parts(u)[1]) }) },
  { match: (u) => /\.notion\.site$/.test(u.hostname), only: true, resolve: async (u) => ({ siteName: "Notion", title: slugTitle(parts(u).at(-1)) }) },
];

export const sourceFor = (url: string): Source | null => {
  try {
    const u = new URL(url);
    return SOURCES.find((s) => s.match(u)) ?? null;
  } catch {
    return null;
  }
};

// Titles and images a site gives every page alike: not the link's own, so they are dropped.
const GENERIC_TITLE = /^(claude|claude artifact|check out this chat|gemini - direct access to google ai|bitbucket|instagram|tiktok - make your day|threads|facebook|reddit - the heart of the internet|reddit - dive into anything|log in or sign up to view|x|youtube|- youtube|.+ \(@\w+\) on x|(\(\d+\) )?.+ on x: .+ \/ x)$/i;
const GENERIC_IMAGE = /(cdn\.openai\.com\/chatgpt\/share-og|pplx-default-preview|lovable\.dev\/opengraph-image|jsfiddle\.net\/img\/og-default|arxiv-logo-fb|github\.githubassets\.com\/assets\/gist-og-image|static\.xx\.fbcdn\.net\/rsrc)/i;

export const isGenericTitle = (t: string | null | undefined) => Boolean(t && GENERIC_TITLE.test(t.trim()));
export const isGenericImage = (src: string | null | undefined) => Boolean(src && GENERIC_IMAGE.test(src));
// "ChatGPT - Planning a trip" → "Planning a trip"
export const withoutPrefix = (t: string | null) => t?.replace(/^ChatGPT\s*[-–]\s*/, "") ?? null;
