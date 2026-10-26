import type { Locale } from "@pluck/i18n";
import MarkdownIt from "markdown-it";
import { localePath } from "./siteUrls";

// The blog, newest first. Each post is Markdown in content/blog/<locale>/<slug>.md, in every site language, imported
// as a string (next.config.ts). Its front matter holds the title, the description and the keywords; keywords go only
// into the structured data, never on the page. Every published post has a hero at public/blog/<slug>/hero.png.
type Entry = { slug: string; date: string; draft?: true };
export type Post = Entry & { locale: Locale; title: string; description: string; keywords: string[]; body: string };

const ALL: Entry[] = [
  { slug: "nothing-is-deleted", date: "2026-10-26" },
  { slug: "forward-the-newsletter", date: "2026-10-26" },
  { slug: "a-list-is-a-plan", date: "2026-10-26" },
  { slug: "run-your-own-pluck", date: "2026-10-26" },
  { slug: "bring-the-rest-across", date: "2026-10-26" },
  { slug: "read-it-later-apps-keep-closing", date: "2026-10-26" },
  { slug: "ask-your-ai-what-you-plucked", date: "2026-10-26" },
  { slug: "omnivore-is-gone", date: "2026-10-26" },
  { slug: "pocket-is-gone", date: "2026-10-26" },
];

// Drafts show in dev, marked, and nowhere in production: not the index, the sitemap or llms.txt.
export const POSTS = process.env.NODE_ENV === "production" ? ALL.filter((p) => !p.draft) : ALL;

async function load(entry: Entry, locale: Locale): Promise<Post> {
  const text = ((await import(`../content/blog/${locale}/${entry.slug}.md`)) as { default: string }).default;
  const [, head, body] = text.match(/^---\n([\s\S]*?)\n---\n+([\s\S]*)$/) ?? [];
  if (!head || !body) throw new Error(`content/blog/${locale}/${entry.slug}.md has no front matter`);
  const field = (key: string) => head.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1] ?? "";
  return { ...entry, locale, title: field("title"), description: field("description"), keywords: field("keywords").split(/,\s*/), body };
}

export const postsIn = (locale: Locale) => Promise.all(POSTS.map((p) => load(p, locale)));
export const findPost = (locale: Locale, slug: string) => {
  const entry = POSTS.find((p) => p.slug === slug);
  return entry ? load(entry, locale) : undefined;
};

// Our own words, so links stay in the tab. Raw HTML stays off all the same.
const md = new MarkdownIt({ html: false, typographer: true });

// A link to a site page stays in the post's language.
md.renderer.rules.link_open = (tokens, idx, options, env: { locale: Locale }, self) => {
  const href = tokens[idx]!.attrGet("href");
  if (href) tokens[idx]!.attrSet("href", localePath(env.locale, href));
  return self.renderToken(tokens, idx, options);
};

// An image still to be made: a ```image <file> fence holding "alt: …" and the brief for Claude Design.
// Dev shows the brief where the image will go; production shows nothing until the fence becomes ![alt](/blog/<file>).
const fence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const { info, content } = tokens[idx]!;
  if (!info.startsWith("image ")) return fence(tokens, idx, options, env, self);
  if (process.env.NODE_ENV === "production") return "";
  const esc = md.utils.escapeHtml;
  return `<figure class="imageTodo"><figcaption>Image for Claude Design · save as <code>apps/web/public/blog/${esc(info.slice(6).trim())}</code></figcaption><pre>${esc(content.trim())}</pre></figure>`;
};

// Reading time: 220 words a minute, or 500 characters where words aren't spaced (Japanese, Chinese).
export function postBody(post: Post) {
  const text = post.body.replace(/```image[\s\S]*?```/g, "");
  const unspaced = post.locale === "ja" || post.locale === "zh-Hans";
  const minutes = unspaced ? text.replace(/\s/g, "").length / 500 : text.split(/\s+/).length / 220;
  return { html: md.render(post.body, { locale: post.locale }), minutes: Math.max(1, Math.round(minutes)) };
}
