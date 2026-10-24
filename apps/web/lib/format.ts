import type { Item, Source } from "@pluck/shared-schemas";

const DAY = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// The "when" column from the Main board: 2h, Yesterday, Tue, 3 Nov.
export function when(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (days === 0) return `${Math.floor(diff / 3_600_000)}h`;
  if (days === 1) return "Yesterday";
  if (days < 7) return WEEKDAY.format(d);
  return (d.getFullYear() === now.getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(d);
}

// "just now", "10 min ago", "yesterday", "on 3 Nov" for sentences like "Plucked from iOS · 10 min ago".
export function ago(iso: string, now = new Date()): string {
  const w = when(iso, now);
  if (w === "now") return "just now";
  if (w.endsWith("m")) return `${w.slice(0, -1)} min ago`;
  if (/^\d+h$/.test(w)) return `${w} ago`;
  if (w === "Yesterday") return "yesterday";
  return `on ${w}`;
}

// "12 min", "photo", "Plucking", "Couldn't read".
export function rowMeta(item: Item): string {
  if (item.extraction.state === "failed") return "Couldn't read";
  if (item.extraction.state === "pending") return "Plucking";
  if (item.kind === "image") return "photo";
  if (item.kind === "video") return "video";
  if (item.wordCount) return `${Math.max(1, Math.round(item.wordCount / 230))} min`;
  return item.kind === "pdf" ? "PDF" : "link";
}

const KNOWN: Record<string, string> = { "youtube.com": "YT", "youtu.be": "YT", "x.com": "X", "twitter.com": "X", "github.com": "GH" };

// Site initials for the 40px tile when there is no cover.
export function initials(siteName: string | null, url: string | null): string {
  const host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  if (KNOWN[host]) return KNOWN[host];
  const words = (siteName ?? host).replace(/^the\s+/i, "").split(/[\s.\-_]+/).filter(Boolean);
  if (words.length >= 2 && siteName && /\s/.test(siteName)) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

// Stable tile colour per site, one of six muted steps (see --tile-* in tokens.css).
export function tileIndex(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 6;
}

const SOURCE: Record<Source, string> = {
  web: "Plucked on the web", extension: "Plucked from the extension", ios: "Plucked from iOS", email: "Plucked by email",
  mcp: "Plucked by your AI", import: "Imported", api: "Plucked with an API key", copied: "Plucked from a public list",
};
export const sourceLabel = (s: Source) => SOURCE[s];

export const coverSrc = (id: string) => `/api/v1/items/${id}/cover`;
export const waybackUrl = (url: string) => `https://web.archive.org/web/*/${url}`;
