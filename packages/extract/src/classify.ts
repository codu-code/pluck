import type { Facts, Preview } from "@pluck/shared-schemas";

// What a link is, from its address alone: the sites whose pages are not articles however much text they carry.
// Read before anything is fetched, so a login wall or an app shell is never mistaken for the thing itself.
export type Guess = { preview: Preview; kind?: "link" | "video"; facts: Facts };

const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
const parts = (u: URL) => u.pathname.split("/").filter(Boolean);

// Ids for the players we embed (shared-schemas PLAYERS), from every address form each site uses.
function player(u: URL): Facts["player"] | null {
  const h = host(u);
  const p = parts(u);
  if (h === "youtube.com" || h === "music.youtube.com" || h === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") ?? (["shorts", "embed", "live", "v"].includes(p[0] ?? "") ? p[1] : null);
    return id && /^[\w-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (h === "youtu.be") return p[0] && /^[\w-]{11}$/.test(p[0]) ? { provider: "youtube", id: p[0] } : null;
  if (h === "vimeo.com" || h === "player.vimeo.com") {
    const id = p.find((s) => /^\d{1,12}$/.test(s));
    return id ? { provider: "vimeo", id } : null;
  }
  if (h === "loom.com") return ["share", "embed"].includes(p[0] ?? "") && /^[a-f0-9]{32}$/.test(p[1] ?? "") ? { provider: "loom", id: p[1]! } : null;
  if (h === "tiktok.com" && p[0]?.startsWith("@") && p[1] === "video" && /^\d{8,24}$/.test(p[2] ?? "")) return { provider: "tiktok", id: p[2]! };
  if (h === "open.spotify.com") {
    const at = p.findIndex((s) => /^(episode|track|show|album|playlist)$/.test(s)); // /intl-de/track/…
    const id = at >= 0 ? p[at + 1] : null;
    return id && /^[A-Za-z0-9]{22}$/.test(id) ? { provider: "spotify", id: `${p[at]}/${id}` } : null;
  }
  return null;
}

const APPS: [RegExp, string, RegExp?][] = [
  [/^claude\.ai$/, "claude", /^\/public\/artifacts\//],
  [/^claude\.ai$/, "claude-chat", /^\/share\//],
  [/^claude\.site$/, "claude"],
  [/^(chatgpt\.com|chat\.openai\.com)$/, "chatgpt", /^\/(share|g|canvas)\//],
  [/^(gemini\.google\.com|g\.co)$/, "gemini", /^\/(share|gemini\/share)\//],
  [/^(v0\.dev|v0\.app)$/, "v0"],
  [/^bolt\.new$/, "bolt"],
  [/^(lovable\.dev|lovable\.app)$/, "lovable"],
  [/^perplexity\.ai$/, "perplexity", /^\/(page|search)\//],
  [/^replit\.com$/, "replit", /^\/@/],
  [/^figma\.com$/, "figma", /^\/(file|design|proto|board|slides|make)\//],
  [/^docs\.google\.com$/, "google-docs", /^\/(document|spreadsheets|presentation|forms)\//],
  [/^drive\.google\.com$/, "google-drive", /^\/(file|drive)\//],
  [/^(.+\.)?notion\.(site|so)$/, "notion"],
  [/^canva\.com$/, "canva", /^\/design\//],
  [/^miro\.com$/, "miro", /^\/app\/board\//],
];

const STACK = /^(stackoverflow\.com|superuser\.com|serverfault\.com|askubuntu\.com|(.+\.)?stackexchange\.com)$/;

function code(u: URL): Facts | null {
  const h = host(u);
  const p = parts(u);
  if (h === "github.com" || h === "gitlab.com" || h === "codeberg.org" || h === "bitbucket.org") {
    if (p.length < 2 || ["features", "pricing", "about", "blog", "topics", "marketplace", "explore", "settings", "login", "users"].includes(p[0]!)) return null;
    const rest = p.slice(2).filter((s) => s !== "-"); // GitLab puts "/-/" before issues and merge requests
    const what = rest[0] === "issues" ? "issue" : rest[0] === "pull" || rest[0] === "merge_requests" || rest[0] === "pull-requests" ? "pull" : rest[0] === "blob" || rest[0] === "tree" || rest[0] === "src" ? "file" : rest.length ? null : "repo";
    return what ? { code: what, handle: `${p[0]}/${p[1]}` } : null;
  }
  if (h === "gist.github.com") return p.length ? { code: "gist", handle: p[0] } : null;
  if (h === "npmjs.com" && p[0] === "package") return { code: "package", handle: p.slice(1).join("/") };
  if (h === "pypi.org" && p[0] === "project" && p[1]) return { code: "package", handle: p[1] };
  if (h === "crates.io" && p[0] === "crates" && p[1]) return { code: "package", handle: p[1] };
  if (STACK.test(h) && p[0] === "questions" && /^\d+$/.test(p[1] ?? "")) return { code: "question" };
  if ((h === "codepen.io" && p[1] === "pen") || (h === "codesandbox.io" && ["s", "p"].includes(p[0] ?? "")) || (h === "stackblitz.com" && p[0] === "edit") || h === "jsfiddle.net") return { code: "snippet" };
  return null;
}

function post(u: URL): Facts | null {
  const h = host(u);
  const p = parts(u);
  if ((h === "x.com" || h === "twitter.com") && p[1] === "status") return { handle: `@${p[0]}` };
  if ((h === "threads.net" || h === "threads.com") && p[0]?.startsWith("@") && p[1] === "post") return { handle: p[0] };
  if (h === "bsky.app" && p[0] === "profile" && p[2] === "post") return { handle: `@${p[1]}` };
  if (h === "reddit.com" || h === "old.reddit.com" || h === "redd.it") return p[0] === "r" && p[2] === "comments" ? { handle: `r/${p[1]}` } : h === "redd.it" ? {} : null;
  if (h === "instagram.com" && ["p", "reel", "reels", "tv"].includes(p[0] ?? "")) return {};
  if (h === "linkedin.com" && (p[0] === "posts" || (p[0] === "feed" && p[1] === "update"))) return {};
  if (h === "facebook.com" && (p.includes("posts") || p[0] === "share" || p[0] === "permalink.php")) return {};
  if (h === "news.ycombinator.com" && p[0] === "item") return {};
  if (h === "lobste.rs" && p[0] === "s") return {};
  if (/^@[\w.]+$/.test(p[0] ?? "") && /^\d{6,}$/.test(p[1] ?? "")) return { handle: p[0] }; // Mastodon and its kin: /@name/123456
  return null;
}

export function fromAddress(url: string): Guess | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const h = host(u);
  const pl = player(u);
  if (pl) {
    const facts: Facts = { player: pl };
    if (pl.provider === "tiktok") Object.assign(facts, { handle: parts(u)[0], vertical: true });
    if (pl.provider === "youtube" && parts(u)[0] === "shorts") facts.vertical = true;
    return { preview: "player", kind: pl.provider === "spotify" ? "link" : "video", facts };
  }
  const c = code(u);
  if (c) return { preview: "code", facts: c };
  const s = post(u);
  if (s) return { preview: "post", kind: h === "instagram.com" && parts(u)[0] !== "p" ? "video" : "link", facts: s };
  for (const [re, app, path] of APPS) if (re.test(h) && (!path || path.test(u.pathname))) return { preview: "app", facts: { app } };
  return null;
}

// ---- What the page says about itself, for every other address ------------------------------------------------

type Doc = Pick<Document, "querySelector" | "querySelectorAll">;

const metaOf = (doc: Doc, name: string) =>
  doc.querySelector(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`)?.getAttribute("content")?.trim() || null;

// Every schema.org node on the page, @graph and arrays flattened.
function ldNodes(doc: Doc): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      out.push(v as Record<string, unknown>);
      if ("@graph" in v) walk((v as { "@graph": unknown })["@graph"]);
    }
  };
  for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(el.textContent ?? ""));
    } catch {
      // a broken block says nothing
    }
  }
  return out;
}
const typesOf = (n: Record<string, unknown>) => [n["@type"]].flat().filter((t): t is string => typeof t === "string");

// "PT1H2M3S" → 3723
export function isoSeconds(s: string | null | undefined): number | undefined {
  const m = s && /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(s.trim());
  if (!m || !m.slice(1).some(Boolean)) return undefined;
  return Math.round((+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0)));
}

function priceOf(doc: Doc, nodes: Record<string, unknown>[]): Facts["price"] | undefined {
  const amount = metaOf(doc, "product:price:amount") ?? metaOf(doc, "og:price:amount");
  const currency = metaOf(doc, "product:price:currency") ?? metaOf(doc, "og:price:currency");
  if (amount && currency && /^[A-Za-z]{3}$/.test(currency) && Number.isFinite(+amount.replace(",", "."))) return { amount: +amount.replace(",", "."), currency: currency.toUpperCase() };
  for (const n of nodes.filter((x) => typesOf(x).includes("Product"))) {
    for (const o of [n.offers].flat() as Record<string, unknown>[]) {
      if (!o) continue;
      const p = o.price ?? o.lowPrice ?? (o.priceSpecification as Record<string, unknown> | undefined)?.price;
      const c = o.priceCurrency ?? (o.priceSpecification as Record<string, unknown> | undefined)?.priceCurrency;
      if (p != null && typeof c === "string" && /^[A-Za-z]{3}$/.test(c) && Number.isFinite(+p)) return { amount: +p, currency: c.toUpperCase() };
    }
  }
  return undefined;
}

const ARTICLE = /^(Article|NewsArticle|BlogPosting|TechArticle|Report|ScholarlyArticle|Recipe|HowTo|Review|LiveBlogPosting|OpinionNewsArticle|AnalysisNewsArticle)$/;

// A page's Preview from its own signals, once fetched. `words` is how much the reader found to read.
export function fromPage(doc: Doc, url: string, words: number): { preview: Preview; facts: Facts } {
  const nodes = ldNodes(doc);
  const types = new Set(nodes.flatMap(typesOf));
  const ogType = metaOf(doc, "og:type")?.toLowerCase() ?? "";
  const facts: Facts = {};
  const posted = metaOf(doc, "article:published_time");
  if (posted) facts.postedAt = posted;

  // A paper's landing page that names its PDF (arXiv, journals, most repositories use citation_pdf_url).
  const pdf = metaOf(doc, "citation_pdf_url");
  if (pdf) {
    try {
      return { preview: "document", facts: { ...facts, pdfUrl: new URL(pdf, url).toString() } };
    } catch {
      // not an address
    }
  }
  const price = priceOf(doc, nodes);
  if (ogType.startsWith("product") || ((types.has("Product") || types.has("ProductGroup")) && price)) return { preview: "product", facts: price ? { ...facts, price } : facts };
  if ([...types].some((t) => ARTICLE.test(t)) || ogType === "article") return { preview: "reader", facts };

  // A homepage: the root of a site (or of a language: /en, /de-de), with nothing that calls itself an article.
  const path = new URL(url).pathname.replace(/\/+$/, "");
  if (!path || /^\/[a-z]{2}(-[a-z]{2,4})?$/i.test(path)) return { preview: "site", facts };
  // Too little to read and nothing that says article: a landing page, an app shell, a sign-in wall.
  if (words < 30) return { preview: "site", facts };
  return { preview: "reader", facts };
}
