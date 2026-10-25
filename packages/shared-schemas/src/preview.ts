import { z } from "zod";
import type { Kind } from "./enums.ts";

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
} as const;
export type Player = keyof typeof PLAYERS;

// What a Preview shows besides the title, site, author, excerpt and cover. Every field is optional: a fact we could
// not find is left out, never guessed.
export const Facts = z
  .object({
    player: z.object({ provider: z.enum(Object.keys(PLAYERS) as [Player, ...Player[]]), id: z.string().max(80) }).optional(),
    seconds: z.number().int().min(0).optional(), // a video's or episode's length
    handle: z.string().max(120).optional(), // a Post's author (@name), a repo's owner/name
    price: z.object({ amount: z.number().min(0), currency: z.string().regex(/^[A-Z]{3}$/) }).optional(),
    code: z.enum(["repo", "issue", "pull", "gist", "file", "package", "snippet", "question"]).optional(),
    language: z.string().max(40).optional(), // a repo's main language
    stars: z.number().int().min(0).optional(),
    pages: z.number().int().min(1).optional(), // a PDF's
    pdfUrl: z.string().url().max(4096).optional(), // a Document's file, when the link is its landing page
    app: z.string().max(40).optional(), // what made an App: "claude", "chatgpt", "figma", "google-docs"…
    postedAt: z.string().optional(),
  })
  .strict();
export type Facts = z.infer<typeof Facts>;

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
