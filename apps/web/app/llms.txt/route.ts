import { POSTS } from "@/lib/blog";
import { CONNECTOR_URL, LICENCE, REPO_URL } from "@/lib/site";

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// llms.txt (llmstxt.org): what Pluck is, in plain Markdown, for AI tools that answer questions about it.
export function GET() {
  const body = `# Pluck

> Pluck is a free, open-source read-it-later app. Pluck a link, a note, a todo, a PDF or an image in one tap from the iPhone share sheet, Chrome, email or your AI tool, and sort it later, by hand or with your AI. Pluck keeps the page, not just the link.

Key facts:

- Free to use at ${base}. Open source (${LICENCE}). Self-host with Docker in one command.
- No AI runs inside Pluck. Your own AI tool (Claude, ChatGPT, Cursor or any MCP client) connects through Pluck's MCP connector at ${CONNECTOR_URL} and reads, searches and sorts your library when you ask.
- Your AI cannot delete anything or make a list public. Everything it adds is marked "by AI".
- Kinds of item: Read, Watch, PDF, Image, Note, Todo, Thing. Status: Inbox, Later, Archived, Done.
- Items you never touch move to the Archive after 30 days (you pick the number, or turn it off). Nothing is deleted.
- Lists: ordered, with a note and a tick per item. Private by default, public at /@handle/slug with one switch.
- Imports from Pocket (CSV), Omnivore (export zip), Raindrop (CSV) and any browser's bookmarks HTML. Export everything as JSON and Markdown.
- Made by Codú Limited, Ireland.

## Pages

- [Home](${base}/): what Pluck does
- [Connect your AI](${base}/connect): set up Claude, Claude Code, ChatGPT, Cursor or a self-hosted bridge, and the tools your AI gets
- [Open source](${base}/open-source): self-hosting, export and what Pluck does with your data
- [Support](${base}/support): answers about the extension, iPhone, your AI and your account
- [iPhone](${base}/iphone): the iPhone app
- [Chrome](${base}/chrome): the Chrome extension

## Blog

${POSTS.map((p) => `- [${p.title}](${base}/blog/${p.slug}): ${p.description}`).join("\n")}

## Optional

- [Source code](${REPO_URL})
- [MCP tools and prompts](${REPO_URL}/blob/main/docs/mcp.md)
- [Self-host guide](${REPO_URL}/blob/main/docs/self-host.md)
- [Privacy](${base}/privacy)
- [Terms](${base}/terms)
`;
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
