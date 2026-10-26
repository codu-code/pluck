import MarkdownIt from "markdown-it";
import closing from "../content/blog/read-it-later-apps-keep-closing.md";
import askAi from "../content/blog/ask-your-ai-what-you-plucked.md";
import omnivore from "../content/blog/omnivore-is-gone.md";
import pocket from "../content/blog/pocket-is-gone.md";
import aList from "../content/blog/a-list-is-a-plan.md";
import rest from "../content/blog/bring-the-rest-across.md";
import newsletter from "../content/blog/forward-the-newsletter.md";
import nothing from "../content/blog/nothing-is-deleted.md";
import selfHost from "../content/blog/run-your-own-pluck.md";

// The blog, newest first. Bodies are Markdown in content/blog, in English only, imported as strings (next.config.ts).
// Keywords go only into the structured data, never on the page. Every published post has a hero at public/blog/<slug>/hero.png.
export type Post = { slug: string; title: string; description: string; date: string; keywords: string[]; body: string; draft?: true };

const ALL: Post[] = [
  {
    slug: "nothing-is-deleted",
    title: "Nothing is deleted.",
    description: "Untouched for 30 days, it moves to the Archive on its own, still searchable. How Pluck lets the pile shrink without throwing anything away.",
    date: "2026-10-26",
    keywords: ["read later backlog", "too many saved articles", "read it later guilt", "auto archive old links", "inbox zero for links"],
    body: nothing,
  },
  {
    slug: "forward-the-newsletter",
    title: "Forward the newsletter.",
    description: "Every Pluck account has its own email address. Forward a newsletter to it and it lands in your Inbox as something to read.",
    date: "2026-10-26",
    keywords: ["read newsletters outside inbox", "forward newsletter to read later", "newsletter reader app", "email to read later"],
    body: newsletter,
  },
  {
    slug: "a-list-is-a-plan",
    title: "A list is a plan.",
    description: "A trip, a talk, a kitchen. Put things in order, add a note to each, and share it with one link when you're ready.",
    date: "2026-10-26",
    keywords: ["share a reading list", "share a list of links", "curated link list", "public reading list", "trip planning links"],
    body: aList,
  },
  {
    slug: "run-your-own-pluck",
    title: "Run your own Pluck.",
    description: "One docker compose, 1 GB of RAM, and the same app on your own server. The whole of it, the awkward parts included.",
    date: "2026-10-26",
    keywords: ["self-hosted read it later", "self-hosted Pocket alternative", "read it later docker", "self-hosted bookmark manager", "open source read later server"],
    body: selfHost,
  },
  {
    slug: "bring-the-rest-across",
    title: "Bring the rest across.",
    description: "A Raindrop CSV, or the file your browser exports. What comes with it, what doesn't, and where it lands.",
    date: "2026-10-26",
    keywords: ["Raindrop alternative", "Raindrop export", "import Chrome bookmarks", "export Safari bookmarks", "search bookmarks full text"],
    body: rest,
  },
  {
    slug: "read-it-later-apps-keep-closing",
    title: "Read-it-later apps keep closing.",
    description: "Pocket went. Omnivore went. Five things to check before you trust the next one with your library.",
    date: "2026-10-26",
    keywords: ["open source read it later", "self-hosted read it later", "Pocket alternative", "Wallabag", "Karakeep", "Linkwarden"],
    body: closing,
  },
  {
    slug: "ask-your-ai-what-you-plucked",
    title: "Ask your AI what you plucked.",
    description: "One link puts your whole library in Claude, ChatGPT, Cursor or any AI tool that speaks MCP. Thirty seconds, and it never deletes.",
    date: "2026-10-26",
    keywords: ["read it later MCP", "MCP server for articles", "connect Claude to reading list", "ChatGPT reading list", "Claude connector"],
    body: askAi,
  },
  {
    slug: "omnivore-is-gone",
    title: "Omnivore is gone. The pages in your zip aren’t.",
    description: "If you kept your Omnivore export, Pluck reads the pages straight out of the zip. Even the ones whose sites are gone.",
    date: "2026-10-26",
    keywords: ["Omnivore alternative", "Omnivore export", "import Omnivore zip", "Omnivore shut down"],
    body: omnivore,
  },
  {
    slug: "pocket-is-gone",
    title: "Pocket is gone. Your export isn’t.",
    description: "Pocket closed in July 2025. If you kept the CSV, your whole library fits in Pluck in one go, tags and dates included.",
    date: "2026-10-26",
    keywords: ["Pocket alternative", "Pocket export", "import Pocket CSV", "Pocket shut down", "Mozilla Pocket replacement"],
    body: pocket,
  },
];

// Drafts show in dev, marked, and nowhere in production: not the index, the sitemap or llms.txt.
export const POSTS = process.env.NODE_ENV === "production" ? ALL.filter((p) => !p.draft) : ALL;

export const findPost = (slug: string) => POSTS.find((p) => p.slug === slug);

// Our own words, so links stay in the tab. Raw HTML stays off all the same.
const md = new MarkdownIt({ html: false, typographer: true });

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

export const postBody = (post: Post) => ({ html: md.render(post.body), minutes: Math.max(1, Math.round(post.body.replace(/```image[\s\S]*?```/g, "").split(/\s+/).length / 220)) });
