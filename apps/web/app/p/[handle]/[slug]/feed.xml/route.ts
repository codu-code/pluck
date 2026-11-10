import { publicRoute } from "@/lib/api";
import { publicPage } from "@/lib/library";
import { listAddress } from "../address";

export const dynamic = "force-dynamic"; // like the page: a List made Private again stops answering at once

// What Next sends with the page, which is never cached. The feed is no more cacheable than the page.
const UNCACHED = "private, no-cache, no-store, max-age=0, must-revalidate";

// Words for XML: what XML 1.0 cannot carry at all (control characters, half a surrogate pair) is dropped, then the five
// characters that mean something to it are escaped.
const x = (s: string) =>
  s.replace(/[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu, "").replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The public List at /@handle/slug as an Atom feed, at /@handle/slug/feed.xml (the rewrite in next.config.ts).
// It is the page in another format, not an API: the same reader as the page (so a List that is Private, taken down or
// whose owner's pages are closed is a 404 here too), only what the page shows, and no parameters. Fetching it is not
// a view. The public projection has no time for each entry, so every entry carries the List's last change.
export const GET = publicRoute<{ handle: string; slug: string }>("public-feed", 300, async ({ params }) => {
  const page = await publicPage(params.handle, params.slug, { count: false });
  if (!page) return new Response(null, { status: 404, headers: { "cache-control": UNCACHED } });
  const { list, author, entries } = page;
  const at = listAddress(author.handle, params.slug);
  const id = `urn:pluck:list:${list.id}`; // the ids, not the address: a new handle or name keeps every entry the same entry
  const xml = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `<id>${id}</id>`,
    `<title>${x(list.name)}</title>`,
    ...(list.purpose ? [`<subtitle>${x(list.purpose)}</subtitle>`] : []),
    `<updated>${list.updatedAt}</updated>`,
    `<author><name>${x(author.name ?? `@${author.handle}`)}</name></author>`,
    `<link rel="self" type="application/atom+xml" href="${x(`${at}/feed.xml`)}"/>`,
    `<link rel="alternate" type="text/html" href="${x(at)}"/>`,
    ...entries.map((e) =>
      `<entry><id>${id}:${e.id}</id><title>${x(e.title)}</title><link rel="alternate" href="${x(e.url ?? at)}"/><updated>${list.updatedAt}</updated>${e.note ? `<summary>${x(e.note)}</summary>` : ""}</entry>`),
    `</feed>`,
  ].join("\n");
  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": UNCACHED,
      ...(list.noindex ? { "x-robots-tag": "noindex, nofollow" } : {}), // as the page's robots tag: a new List stays out of search
    },
  });
});
