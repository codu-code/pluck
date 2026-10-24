import { isTextKind } from "./notes.ts";
import type { Item } from "./items.ts";
import type { Source } from "./enums.ts";

// How an item reads in a row, shared by the web app and the iOS app.

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

const SHORT_DUE = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

// "due Fri" within the coming week, "due 3 Nov" after that.
export function dueLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  if (days < 0) return "overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 7) return `due ${SHORT_DUE.format(d)}`;
  return `due ${DAY_MONTH.format(d)}`;
}

const TEXT_SITE = { note: "Note", todo: "Todo", thing: "Thing" } as const;

// The row's "site" slot: the site for links, the kind for notes, todos and things.
export function rowSite(item: Item): string {
  if (isTextKind(item.kind)) return TEXT_SITE[item.kind as keyof typeof TEXT_SITE] ?? "Note";
  // Without a page behind it, the item came by email or is a file someone plucked from a phone, the web or a tool.
  return item.siteName ?? (item.url ? new URL(item.url).hostname : item.source === "email" ? "email-in" : "Your file");
}

// "12 min", "photo", "Plucking", "Couldn't read", "by you", "due Fri".
export function rowMeta(item: Item, now = new Date()): string {
  if (isTextKind(item.kind)) return item.dueAt ? dueLabel(item.dueAt, now) : item.source === "mcp" ? "by AI" : "by you";
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

