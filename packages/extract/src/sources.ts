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

// HTML from an API (a post body, a README) as plain paragraphs.
function textOf(html: string | null | undefined): string {
  if (!html) return "";
  const { document } = parseHTML(`<div>${html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h\d|pre|blockquote)>/gi, "$&\n\n")}</div>`);
  return (document.querySelector("div")?.textContent ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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

  // X documents its oEmbed as open and unlimited; its page's tags carry the same text when they come through.
  {
    match: (u) => /^(x\.com|twitter\.com)$/.test(host(u)) && parts(u)[1] === "status",
    resolve: async (u, signal) => {
      const o = await oembed("https://publish.x.com/oembed?omit_script=1&dnt=true", u, signal);
      const text = textOf(/<p[^>]*>([\s\S]*?)<\/p>/.exec(o.html ?? "")?.[1]);
      return { siteName: "X", author: clean(o.author_name), ...(text ? { markdown: text, excerpt: text.slice(0, 400) } : {}) };
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
      const t = await json<{ thread?: { post?: { author?: { displayName?: string; handle?: string }; record?: { text?: string }; embed?: { images?: { fullsize?: string }[] } } } }>(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(`at://${who}/app.bsky.feed.post/${rkey}`)}&depth=0`, signal);
      const post = t.thread?.post;
      const text = clean(post?.record?.text);
      return { siteName: "Bluesky", author: clean(post?.author?.displayName) ?? post?.author?.handle ?? null, coverUrl: post?.embed?.images?.[0]?.fullsize ?? null, ...(text ? { markdown: post!.record!.text!, excerpt: text.slice(0, 400) } : {}) };
    },
  },
  {
    // Mastodon and its kin, on any server: /@name/123456. Public posts answer without signing in.
    match: (u) => /^@[\w.]+$/.test(parts(u)[0] ?? "") && /^\d{6,}$/.test(parts(u)[1] ?? "") && !/^(tiktok\.com|threads\.(net|com))$/.test(host(u)),
    resolve: async (u, signal) => {
      const s = await json<{ content?: string; account?: { display_name?: string; acct?: string }; media_attachments?: { type?: string; url?: string; preview_url?: string }[] }>(`${u.origin}/api/v1/statuses/${parts(u)[1]}`, signal);
      const text = textOf(s.content);
      const image = s.media_attachments?.find((m) => m.type === "image");
      return { author: clean(s.account?.display_name) ?? s.account?.acct ?? null, coverUrl: image?.preview_url ?? image?.url ?? null, ...(text ? { markdown: text, excerpt: text.slice(0, 400) } : {}) };
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
const GENERIC_TITLE = /^(claude|claude artifact|check out this chat|gemini - direct access to google ai|bitbucket|instagram|tiktok - make your day|threads|facebook|reddit - the heart of the internet|reddit - dive into anything|log in or sign up to view)$/i;
const GENERIC_IMAGE = /(cdn\.openai\.com\/chatgpt\/share-og|pplx-default-preview|lovable\.dev\/opengraph-image|jsfiddle\.net\/img\/og-default|arxiv-logo-fb|github\.githubassets\.com\/assets\/gist-og-image|static\.xx\.fbcdn\.net\/rsrc)/i;

export const isGenericTitle = (t: string | null | undefined) => Boolean(t && GENERIC_TITLE.test(t.trim()));
export const isGenericImage = (src: string | null | undefined) => Boolean(src && GENERIC_IMAGE.test(src));
// "ChatGPT - Planning a trip" → "Planning a trip"
export const withoutPrefix = (t: string | null) => t?.replace(/^ChatGPT\s*[-–]\s*/, "") ?? null;
