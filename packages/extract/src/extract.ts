import { Readability } from "@mozilla/readability";
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy } from "unpdf";
import { guardedFetch } from "./fetch.ts";

export type ExtractedKind = "link" | "video" | "pdf" | "image";

export type Extracted = {
  kind: ExtractedKind;
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
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/;

function meta(doc: Document, ...names: string[]): string | null {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
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
export async function extractFromHtml(html: string, url: string): Promise<Extracted> {
  const { document } = parseHTML(html);
  const doc = document as unknown as Document;
  const ogTitle = meta(doc, "og:title", "twitter:title");
  const description = meta(doc, "og:description", "description", "twitter:description");
  const coverUrl = absolute(meta(doc, "og:image", "og:image:url", "twitter:image"), url);
  const canonicalUrl = absolute(doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null, url);
  const lang = clean(doc.documentElement?.getAttribute("lang"))?.split("-")[0]?.toLowerCase() ?? null;
  const host = new URL(url).hostname;
  const kind: ExtractedKind = VIDEO_HOSTS.test(host) || meta(doc, "og:type")?.startsWith("video") ? "video" : "link";

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
  // A page with no readable body (an SPA shell, a video page) keeps its description as the text.
  const words = countWords(markdown);
  return {
    kind,
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
    extractor,
    raw: { contentType: "text/html; charset=utf-8", body: Buffer.from(html) },
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
    kind: "pdf", url, canonicalUrl: null, title: clean(info?.Title) ?? fileName, siteName: new URL(url).hostname, author: clean(info?.Author),
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
    kind: "image", url: "", canonicalUrl: null, title: fileName.replace(/\.[a-z0-9]+$/i, "") || null, siteName: null, author: null, excerpt: null,
    lang: null, coverUrl: null, markdown: "", wordCount: 0, extractor: "none", raw: { contentType, body },
  };
}

export type ExtractInput = { url: string; html?: string | null };

// Client HTML wins (the extension and the Safari share sheet send what the browser rendered). Otherwise fetch.
export async function extract({ url, html }: ExtractInput, { signal }: { signal?: AbortSignal } = {}): Promise<Extracted> {
  if (html) return extractFromHtml(html, url);
  const res = await guardedFetch(url, { signal });
  const type = res.contentType.toLowerCase();
  if (type.includes("application/pdf")) return extractPdf(res.url, res.body);
  if (type.startsWith("image/")) {
    const name = fileNameOf(res.url);
    return {
      kind: "image", url: res.url, canonicalUrl: null, title: name, siteName: new URL(res.url).hostname, author: null, excerpt: null,
      lang: null, coverUrl: res.url, markdown: "", wordCount: 0, extractor: "none", raw: { contentType: type, body: res.body },
    };
  }
  return extractFromHtml(decodeHtml(res.body, res.contentType), res.url);
}
