import { Readability } from "@mozilla/readability";
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy } from "unpdf";
import type { Facts, Preview } from "@pluck/shared-schemas";
import { fromAddress, fromPage, isoSeconds } from "./classify.ts";
import { guardedFetch } from "./fetch.ts";
import { isGenericImage, isGenericTitle, sourceFor, withoutPrefix, type Found } from "./sources.ts";

export type ExtractedKind = "link" | "video" | "pdf" | "image";

export type Extracted = {
  kind: ExtractedKind;
  preview: Preview | null; // null for an Image
  facts: Facts;
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  lang: string | null;
  coverUrl: string | null;
  markdown: string;
  wordCount: number;
  extractor: "defuddle" | "readability" | "meta" | "unpdf" | "none";
  // The bytes to keep: page HTML, the PDF or the image. Null when nothing was fetched.
  raw: { contentType: string; body: Buffer } | null;
};

const countWords = (text: string) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const clean = (s: string | null | undefined) => (s && s.replace(/\s+/g, " ").trim()) || null;
// Plain text for the row's second line: markdown escapes and markup removed.
const excerptOf = (text: string) =>
  clean(text.replace(/\\([\\`*_{}[\]()#+\-.!>|])/g, "$1").replace(/[#>*_`[\]()!]|^-\s/gm, " ").slice(0, 400))?.slice(0, 200) ?? null;

function meta(doc: Document, ...names: string[]): string | null {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`);
    const v = clean(el?.getAttribute("content"));
    if (v) return v;
  }
  return null;
}

const absolute = (href: string | null, base: string) => {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

// Pure: no network. Turns page HTML into the item's fields and its markdown.
// `asArticle`: the person chose Show as article, so the body is kept whatever the link looks like.
export async function extractFromHtml(html: string, url: string, { asArticle = false }: { asArticle?: boolean } = {}): Promise<Extracted> {
  const { document } = parseHTML(html);
  const doc = document as unknown as Document;
  const ogTitle = meta(doc, "og:title", "twitter:title");
  const description = meta(doc, "og:description", "description", "twitter:description");
  const coverUrl = absolute(meta(doc, "og:image", "og:image:url", "twitter:image"), url);
  const canonicalUrl = absolute(doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null, url);
  const lang = clean(doc.documentElement?.getAttribute("lang"))?.split("-")[0]?.toLowerCase() ?? null;

  let markdown = "";
  let extractor: Extracted["extractor"] = "meta";
  let title = ogTitle ?? clean(doc.querySelector("title")?.textContent);
  let siteName = meta(doc, "og:site_name", "application-name");
  let author = meta(doc, "author", "article:author");

  try {
    const d = await Defuddle(html, url, { separateMarkdown: true, useAsync: false });
    markdown = d.contentMarkdown?.trim() ?? "";
    if (countWords(markdown) > 0) extractor = "defuddle";
    title = ogTitle ?? clean(d.title) ?? title;
    siteName = siteName ?? clean(d.site);
    author = author ?? clean(d.author);
  } catch {
    // fall through to Readability
  }
  if (extractor === "meta") {
    const article = new Readability(parseHTML(html).document as unknown as Document).parse();
    const text = article?.textContent?.trim() ?? "";
    if (countWords(text) > 0) {
      markdown = text.replace(/\n{3,}/g, "\n\n");
      extractor = "readability";
      title = title ?? clean(article?.title);
      author = author ?? clean(article?.byline);
    }
  }
  // What the link is: its address first (sites whose pages are not articles), else what the page says about itself.
  const found = countWords(markdown);
  const guess = fromAddress(url);
  const { preview, facts } = guess ?? fromPage(doc, url, found);
  const kind: ExtractedKind = guess?.kind ?? (meta(doc, "og:type")?.startsWith("video") ? "video" : "link");
  if (preview === "player") {
    const seconds = isoSeconds(meta(doc, "duration")) ?? (Number(meta(doc, "og:video:duration", "video:duration")) || undefined);
    if (seconds) facts.seconds = seconds;
  }
  // Only an article (and a repo's README, a paper) is worth its body. For anything else the page's text is a sign-in
  // wall, an app shell or a shop's furniture, so what is kept is what the page says it is.
  const keepsBody = asArticle || preview === "reader" || preview === "code" || preview === "document";
  if (!keepsBody) markdown = description ?? "";
  const words = keepsBody ? found : countWords(markdown);
  return {
    kind,
    preview,
    facts,
    url,
    canonicalUrl,
    title,
    siteName,
    author,
    excerpt: description ?? excerptOf(markdown),
    lang,
    coverUrl,
    markdown: words > 0 ? markdown : (description ?? ""),
    wordCount: words,
    extractor: keepsBody ? extractor : "meta",
    raw: asArticle || preview === "reader" ? { contentType: "text/html; charset=utf-8", body: Buffer.from(html) } : null, // the page itself only when it is the thing
  };
}

// The last part of the path as a name. A stray % ("50%off.pdf") or a Latin-1 escape is not valid percent-encoding,
// and throwing there would lose a page that read fine; keep the name as it is.
function fileNameOf(url: string): string | null {
  const last = new URL(url).pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || null;
  } catch {
    return last || null;
  }
}

// Most pages are UTF-8, but not all: the header's charset, else the page's own <meta>, else UTF-8.
function decodeHtml(body: Buffer, contentType: string): string {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString("latin1"))?.[1];
  try {
    return new TextDecoder(declared ?? "utf-8").decode(body);
  } catch {
    return body.toString("utf8"); // a label TextDecoder does not know
  }
}

async function extractPdf(url: string, body: Buffer): Promise<Extracted> {
  const pdf = await getDocumentProxy(new Uint8Array(body));
  const { text } = await extractText(pdf, { mergePages: true });
  const info = (await pdf.getMetadata().catch(() => null))?.info as { Title?: string; Author?: string } | undefined;
  const fileName = fileNameOf(url);
  return {
    kind: "pdf", preview: "document", facts: pdf.numPages ? { pages: pdf.numPages } : {}, url, canonicalUrl: null, title: clean(info?.Title) ?? fileName, siteName: new URL(url).hostname, author: clean(info?.Author),
    excerpt: excerptOf(text), lang: null, coverUrl: null, markdown: text.trim(), wordCount: countWords(text), extractor: "unpdf",
    raw: { contentType: "application/pdf", body },
  };
}

// A file shared from a phone (no URL): a PDF's text, or an image kept as it is.
export async function extractFile({ body, contentType, fileName }: { body: Buffer; contentType: string; fileName: string }): Promise<Extracted> {
  if (contentType === "application/pdf") {
    const x = await extractPdf(`file:///${encodeURIComponent(fileName)}`, body);
    return { ...x, url: "", siteName: null, title: x.title === fileName ? fileName.replace(/\.pdf$/i, "") : x.title };
  }
  return {
    kind: "image", preview: null, facts: {}, url: "", canonicalUrl: null, title: fileName.replace(/\.[a-z0-9]+$/i, "") || null, siteName: null, author: null, excerpt: null,
    lang: null, coverUrl: null, markdown: "", wordCount: 0, extractor: "none", raw: { contentType, body },
  };
}

// `title`: what the person's device called the link (the iPhone's own link preview), when the page has none.
export type ExtractInput = { url: string; html?: string | null; title?: string | null };

// What a link says with nothing fetched: the Preview its address gives, and nothing else.
function fromAddressOnly(url: string): Extracted {
  const guess = fromAddress(url);
  return {
    kind: guess?.kind ?? "link", preview: guess?.preview ?? "site", facts: guess?.facts ?? {}, url, canonicalUrl: null, title: null,
    siteName: new URL(url).hostname.replace(/^www\./, ""), author: null, excerpt: null, lang: null, coverUrl: null, markdown: "", wordCount: 0, extractor: "meta", raw: null,
  };
}

// A source's own answer laid over what the page said: its fields win where it has them, its facts join the page's.
// Except over a page the person's browser sent: what they saw beats a guess from the address.
function merge(x: Extracted, f: Found | null, sent = false): Extracted {
  const out = { ...x, title: isGenericTitle(x.title) ? null : withoutPrefix(x.title), coverUrl: isGenericImage(x.coverUrl) ? null : x.coverUrl };
  if (!f) return out;
  // What the browser sent wins, except for a post: the site's API has the post itself, the page around it is the site.
  const page = sent && (f.preview ?? out.preview) !== "post";
  for (const k of ["title", "author", "siteName", "excerpt", "coverUrl"] as const) if (f[k] && !(page && out[k])) out[k] = f[k];
  if (f.preview) out.preview = f.preview;
  if (f.kind) out.kind = f.kind;
  out.facts = { ...x.facts, ...f.facts };
  if (f.markdown && !(page && x.wordCount)) {
    out.markdown = f.markdown;
    out.wordCount = countWords(f.markdown);
    out.extractor = "meta";
  }
  return out;
}

// Client HTML wins (the extension and the Safari share sheet send what the browser rendered). Otherwise fetch, except
// from the sites whose own pages are no use to a server, which answer through their APIs (sources.ts) instead.
export async function extract({ url, html, title }: ExtractInput, { signal, asArticle }: { signal?: AbortSignal; asArticle?: boolean } = {}): Promise<Extracted> {
  const source = sourceFor(url);
  const found = source?.resolve ? source.resolve(new URL(url), signal).catch(() => null) : Promise.resolve(null);
  let page: Extracted | null = null;
  try {
    if (html) page = await extractFromHtml(html, url, { asArticle });
    else if (!source?.only) page = await fetchAndRead(url, signal, asArticle);
  } catch (e) {
    if (!source) throw e; // a site we know still has its address and its API to go on
  }
  const f = await found;
  // An X Article plucked from the person's signed-in browser: that page has the whole Article, pictures and all, where
  // X's JSON has only its summary. Read it as an article when it really has more.
  if (f?.facts?.article && html) {
    const whole = await extractFromHtml(html, url, { asArticle: true }).catch(() => null);
    if (whole && whole.wordCount >= Math.max(150, countWords(f.markdown ?? "") * 2))
      return { ...whole, kind: "link", preview: "reader", siteName: "X", title: f.title ?? whole.title, author: f.author ?? whole.author, coverUrl: f.coverUrl ?? whole.coverUrl, facts: { ...whole.facts, ...(f.facts.handle ? { handle: f.facts.handle } : {}) } }; // the whole Article is here now
  }
  const x = merge(page ?? fromAddressOnly(url), f, Boolean(html && page));
  // Nothing from the page or the site: the device's title, else a name from the address, never the address itself.
  // The address it ended at names it: a short link (vm.tiktok.com) says nothing until it is followed.
  const at = x.url || url;
  if (!x.title) x.title = (isGenericTitle(title) ? null : clean(title)) ?? (sourceFor(at) ?? source)?.name?.(new URL(at)) ?? null;
  return x;
}

async function fetchAndRead(url: string, signal?: AbortSignal, asArticle?: boolean): Promise<Extracted> {
  const res = await guardedFetch(url, { signal });
  const type = res.contentType.toLowerCase();
  // Some hosts (Google Drive among them) send a PDF as plain bytes; its first bytes say what it is.
  if (type.includes("application/pdf") || res.body.subarray(0, 5).toString("latin1") === "%PDF-") return extractPdf(res.url, res.body);
  if (type.startsWith("image/")) {
    const name = fileNameOf(res.url);
    return {
      kind: "image", preview: null, facts: {}, url: res.url, canonicalUrl: null, title: name, siteName: new URL(res.url).hostname, author: null, excerpt: null,
      lang: null, coverUrl: res.url, markdown: "", wordCount: 0, extractor: "none", raw: { contentType: type, body: res.body },
    };
  }
  return extractFromHtml(decodeHtml(res.body, res.contentType), res.url, { asArticle });
}
