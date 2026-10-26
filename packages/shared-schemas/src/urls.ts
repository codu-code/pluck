// URL handling shared by every client and the server. Pure and browser-safe.

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|mkt_tok|ref_src|ref_url|yclid|oly_enc_id|oly_anon_id|vero_id|__s)$/i;
const PER_HOST: [RegExp, RegExp][] = [
  [/(^|\.)(x|twitter)\.com$/, /^(s|t)$/],
  [/(^|\.)(youtube\.com|youtu\.be)$/, /^(si|feature|pp)$/],
  [/(^|\.)instagram\.com$/, /^(igsh)$/],
];

// The form a URL is deduped on: lowercase scheme and host, no default port, no fragment,
// no tracking parameters, the rest sorted. Returns null for anything that is not http(s).
export function normalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost" && !url.hostname.startsWith("[")) return null;
  url.hash = "";
  const hostRule = PER_HOST.find(([host]) => host.test(url.hostname))?.[1];
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.test(key) || hostRule?.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export const MAX_URLS_PER_PLUCK = 50;

// Whitespace, quotes, brackets, CJK punctuation and ",http" end a candidate. "/https://" inside a path (Wayback) does not.
const CANDIDATE = /\bhttps?:\/\/(?:(?!,https?:\/\/)[^\s<>"'`。，、）】「」])+|\bwww\.(?:(?!,https?:\/\/)[^\s<>"'`。，、）】「」])+/gi;
const TRAILING = /[.,;:!?'"’”…»。，、）】]+$/;

// A URL that ends in ")" keeps it only if the URL has the matching "(" (Wikipedia, MSDN).
function trimEnd(candidate: string): string {
  let s = candidate;
  for (;;) {
    const before = s;
    s = s.replace(TRAILING, "");
    if (/[)\]}]$/.test(s)) {
      const close = s.at(-1)!;
      const open = close === ")" ? "(" : close === "]" ? "[" : "{";
      if (s.split(open).length - 1 < s.split(close).length - 1) s = s.slice(0, -1);
    }
    if (s === before) return s;
  }
}

// Every link in a block of text, normalised and deduped in order, at most 50.
// Shared by the web paste box, the iOS share extension, email-in and MCP save_item.
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(CANDIDATE)) {
    const raw = trimEnd(m[0]);
    // Skip an address like name@www.example.com: the match must not follow "@".
    if (text[m.index - 1] === "@") continue;
    const url = normalizeUrl(raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length === MAX_URLS_PER_PLUCK) break;
  }
  return out;
}

// The tag on a link as it is opened from Pluck, so the site can see who sent it the visit (as Pocket's
// utm_source did). Only when opening: never stored, never on a copied or shared link. A link that already names its
// source, or whose query is signed (one more parameter would break the signature), goes as it is.
export const REFERRAL = "utm_source=getpluck.io";
// Signed and one-time links (S3, GCS, CloudFront, HMAC tokens) put every other parameter under the signature.
const SIGNED = /^(x-amz-.+|x-goog-.+|signature|sig|key-pair-id|expires|token|hmac|hash)$/i;

export function withReferral(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || /(^|\.)getpluck\.io$/i.test(u.hostname)) return url;
  if ([...u.searchParams.keys()].some((k) => k.toLowerCase() === "utm_source" || SIGNED.test(k))) return url;
  // Added to the query as written, before any #fragment: re-serialising it (searchParams) would change q=a%20b to q=a+b.
  const hash = url.indexOf("#");
  const [head, tail] = hash < 0 ? [url, ""] : [url.slice(0, hash), url.slice(hash)];
  return `${head}${head.includes("?") ? (head.endsWith("?") || head.endsWith("&") ? "" : "&") : "?"}${REFERRAL}${tail}`;
}

// A post's words as runs of text and links, for the screens that show them: [words](address) and bare addresses
// become links, and a link whose words are its own address shows as host and path, shortened.
export type TextRun = { text: string; href?: string };
const RUN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"’”]/g;

export function textRuns(text: string): TextRun[] {
  const out: TextRun[] = [];
  let at = 0;
  for (const m of text.matchAll(RUN)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    const href = m[2] ?? m[0];
    const words = m[1] ?? href;
    out.push({ text: /^https?:\/\//.test(words) ? shortAddress(words) : words, href });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

// "https://www.example.com/a/long/path?x=1" → "example.com/a/long/path?x…"
export function shortAddress(url: string, max = 40): string {
  const s = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
