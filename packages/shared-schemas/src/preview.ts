import { z } from "zod";
import type { Kind } from "./enums.ts";
import type { Item } from "./items.ts";

// The screen a link Item opens on (GLOSSARY: Preview), chosen by what the link is.
export const Preview = z.enum(["reader", "player", "post", "code", "product", "site", "document", "app"]);
export type Preview = z.infer<typeof Preview>;

// Players we embed, each built from an id here and never from a stored address, so a page cannot put its own
// frame in front of anyone. Loaded only when tapped (no cookies before that), on each provider's quieter domain.
export const PLAYERS = {
  youtube: { id: /^[\w-]{11}$/, src: (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`, ratio: 16 / 9 },
  vimeo: { id: /^\d{1,12}$/, src: (id: string) => `https://player.vimeo.com/video/${id}?dnt=1&autoplay=1`, ratio: 16 / 9 },
  loom: { id: /^[a-f0-9]{32}$/, src: (id: string) => `https://www.loom.com/embed/${id}?autoplay=1`, ratio: 16 / 9 },
  spotify: { id: /^(episode|track|show|album|playlist)\/[A-Za-z0-9]{22}$/, src: (id: string) => `https://open.spotify.com/embed/${id}`, ratio: 0 }, // 0: a fixed 152pt bar
  tiktok: { id: /^\d{8,24}$/, src: (id: string) => `https://www.tiktok.com/player/v1/${id}?music_info=1&description=1`, ratio: 9 / 16 },
  // Meta's terms allow showing a post, not keeping what its oEmbed says, so a reel is played from its address alone.
  instagram: { id: /^[\w-]{5,40}$/, src: (id: string) => `https://www.instagram.com/reel/${id}/embed/`, ratio: 9 / 16 },
} as const;
export type Player = keyof typeof PLAYERS;

// What a Preview shows besides the title, site, author, excerpt and cover. Every field is optional: a fact we could
// not find is left out, never guessed.
export const Facts = z
  .object({
    player: z.object({ provider: z.enum(Object.keys(PLAYERS) as [Player, ...Player[]]), id: z.string().max(80) }).optional(),
    seconds: z.number().int().min(0).optional(), // a video's or episode's length
    vertical: z.boolean().optional(), // a Short or a reel: the player stands 9:16
    handle: z.string().max(120).optional(), // a Post's author (@name), a repo's owner/name
    price: z.object({ amount: z.number().min(0), currency: z.string().regex(/^[A-Z]{3}$/) }).optional(),
    code: z.enum(["repo", "issue", "pull", "gist", "file", "package", "snippet", "question"]).optional(),
    language: z.string().max(40).optional(), // a repo's main language
    stars: z.number().int().min(0).optional(),
    pages: z.number().int().min(1).optional(), // a PDF's
    pdfUrl: z.string().url().max(4096).optional(), // a Document's file, when the link is its landing page
    app: z.string().max(40).optional(), // what made an App: "claude", "chatgpt", "figma", "google-docs"…
    postedAt: z.string().optional(),
    article: z.boolean().optional(), // an X Article: Pluck has its summary, the whole of it is on X
  })
  .strict();
export type Facts = z.infer<typeof Facts>;

// The Previews that are not for reading in Pluck (a player, a post, a product, a homepage, an app): shown as a card
// with one way out. A Reader, a repo or a paper reads here as an article.
export const isCardPreview = (preview: Preview | null | undefined) => preview === "player" || preview === "post" || preview === "product" || preview === "site" || preview === "app";

// A link the person may name: a reel, a TikTok, a post or a picture often comes with no title of its own. An article,
// a paper or a repo is named by its page. The iPhone share sheet (ShareView.swift) keeps the same rule.
export const isRenameable = (item: { kind: Kind; preview: Preview | null | undefined }) =>
  item.preview === "player" || item.preview === "post" || item.kind === "image";

// The Preview an Item has before anything better is known: older Items, and Kinds with only one way to show.
export function defaultPreview(kind: Kind): Preview | null {
  return kind === "link" ? "reader" : kind === "video" ? "player" : kind === "pdf" ? "document" : null;
}

// The player's address for these facts, or null when there is no player we allow.
export function playerSrc(facts: Facts | null | undefined): string | null {
  const p = facts?.player;
  if (!p) return null;
  const player = PLAYERS[p.provider];
  return player.id.test(p.id) ? player.src(p.id) : null;
}

export type CodeWhat = NonNullable<Facts["code"]>;
export const APP_NAMES = ["claude", "claude-chat", "chatgpt", "gemini", "v0", "bolt", "lovable", "perplexity", "replit", "figma", "google-docs", "google-drive", "notion", "canva", "miro"] as const;

// The one fact a row shows for a Preview in place of the read time, for each surface to put in its own words:
// "4 min" for a video, "@niall" for a post, "repo · TypeScript", "£24.99", "homepage", "12 pages", "Claude artifact".
export type RowFact =
  | { key: "length"; minutes: number }
  | { key: "handle"; handle: string }
  | { key: "code"; what: CodeWhat; language?: string }
  | { key: "price"; amount: number; currency: string }
  | { key: "homepage" }
  | { key: "pages"; count: number }
  | { key: "app"; app: (typeof APP_NAMES)[number] }
  | { key: "post" };

export function rowFact(item: Pick<Item, "preview" | "facts">): RowFact | null {
  const f = item.facts;
  switch (item.preview) {
    case "player": return f.seconds ? { key: "length", minutes: Math.max(1, Math.round(f.seconds / 60)) } : null;
    case "post": return f.handle ? { key: "handle", handle: f.handle } : { key: "post" };
    case "code": return f.code ? { key: "code", what: f.code, ...(f.language ? { language: f.language } : {}) } : null;
    case "product": return f.price ? { key: "price", ...f.price } : null;
    case "site": return { key: "homepage" };
    case "document": return f.pages ? { key: "pages", count: f.pages } : null;
    case "app": return f.app && (APP_NAMES as readonly string[]).includes(f.app) ? { key: "app", app: f.app as (typeof APP_NAMES)[number] } : null;
    default: return null;
  }
}
