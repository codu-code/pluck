import { addToList, claimStarters, createList, editItem, getMe, listLists, markStarters, slugify } from "@pluck/db";
import { DEFAULT_LOCALE, messagesFor, type Locale } from "@pluck/i18n";
import type { List } from "@pluck/shared-schemas";
import { log } from "../log";
import { ORIGIN } from "../origin";
import { pluck } from "./items";

type Defer = (task: () => Promise<void>) => void;

// What an account starts with, so the first pluck has somewhere to go and nothing opens empty: two Lists, Favourites
// and Ideas, named in the account's language. A new account also gets two of our own posts to try things on: one in
// the Inbox, and one in Ideas (out of the Inbox, as something put in a List is).
//
// An account from before this existed gets the Lists only, and gently: nothing is added to a library someone already
// keeps, a List they already have by that name is not made again, and the new ones sort under the Lists they use (as
// old as the account).
//
// Made once (claimStarters): they are ordinary Lists and Items, so renaming, archiving or deleting them is final.
// They are marked (markStarters) only so the weekly email and "have they plucked yet" leave them out.
const INBOX_POST = "nothing-is-deleted";
const IDEAS_POST = "ask-your-ai-what-you-plucked";

export async function giveStarters(userId: string, { articles, locale, defer }: { articles: boolean; locale?: Locale; defer?: Defer }): Promise<void> {
  if (!(await claimStarters(userId))) return;
  const me = articles && locale ? null : await getMe(userId);
  const lang = locale ?? me?.settings.locale ?? DEFAULT_LOCALE;
  const names = messagesFor("app", lang).starters;
  const have = new Set(articles ? [] : (await listLists(userId)).map((l) => slugify(l.name)));
  const since = me && !articles ? new Date(me.createdAt).getTime() : null;
  // Ideas first (a millisecond older for an account from before), so Favourites leads where Lists are shown by what was touched last.
  const made: List[] = [];
  for (const [name, age] of [[names.ideas, 1], [names.favourites, 0]] as const)
    if (!have.has(slugify(name))) made.push(await createList(userId, { name, createdBy: "user", ...(since === null ? {} : { lastActivityAt: new Date(since - age) }) }));
  const posts: string[] = [];
  const ideas = made.find((l) => l.name === names.ideas);
  // The posts are a kindness: an account without them is still whole, so a failure here is logged and left.
  if (articles) {
    try {
      const inbox = await keepPost(userId, lang, INBOX_POST, defer);
      if (inbox) posts.push(inbox);
      const idea = ideas && (await keepPost(userId, lang, IDEAS_POST, defer));
      if (idea) {
        posts.push(idea);
        await editItem(userId, idea, { status: "archived" });
        await addToList(userId, ideas.id, [idea], { by: "user" });
      }
    } catch (e) {
      log("warn", "starter posts not kept", { userId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  await markStarters(userId, { listIds: made.map((l) => l.id), itemIds: posts });
}

// One of our posts, plucked for the account from the words this server already holds: nothing is fetched but its
// picture, after the response.
async function keepPost(userId: string, locale: Locale, slug: string, defer?: Defer): Promise<string | null> {
  const { findPost, postBody } = await import("../blog"); // imported when used: the posts are Markdown the bundler loads
  const { localePath } = await import("../siteUrls");
  const post = await findPost(locale, slug);
  if (!post) return null;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const html =
    `<!doctype html><html lang="${locale}"><head><title>${esc(post.title)}</title><meta name="description" content="${esc(post.description)}">` +
    `<meta property="og:site_name" content="Pluck"><meta property="og:image" content="${ORIGIN}/blog/${slug}/hero.png"></head>` +
    `<body><article><h1>${esc(post.title)}</h1>${postBody(post).html}</article></body></html>`;
  const { item } = await pluck(userId, { url: `${ORIGIN}${localePath(locale, `/blog/${slug}`)}`, html, title: post.title, source: "web" }, { defer });
  return item.id;
}
