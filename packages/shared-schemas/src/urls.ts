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
