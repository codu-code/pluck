import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.legal.privacy.meta");
  return { title: t("title"), description: t("description") };
}

// The legal text stays in English, which governs; the headings are translated (site.legal).
const SECTIONS = [
  { key: "store", p: "Your email and name. Every item you pluck: the link, the page text and images we fetched, your title, note, tags, kind, status, lists, highlights and reading position. The time you plucked it and the time you last opened it, which the expiry rule and the Monday email use. Items you import from Pocket, Omnivore, Raindrop or a bookmarks file." },
  { key: "dont", p: "We don't read your library. No person looks at it unless you ask us to for support. We don't sell it or share it with advertisers. There are no ads. The app has no AI model inside it, so nothing you pluck is sent to a model by us." },
  { key: "extension", p: "While you are signed in, the extension asks your Pluck server whether the page you are on is already in your library, so its icon can fill in. That address is only used to answer the question: it is not added to your library or kept with your account. Turn it off by signing out of the extension or removing it." },
  { key: "ai", p: "If you connect an AI tool over MCP, that tool reads your library on your behalf and sends what it reads to its own provider. That is between you and them. You can disconnect it at any time in Settings. Everything the tool changes is marked as changed by AI and can be undone in bulk." },
  { key: "publicLists", p: "A list is private until you make it public. A public list shows its name, purpose, your name and handle, each item's title, cover, site and your note, with links out to the originals. It never shows the stored page text, your tags, ticks or anything else in your library. Flip it back to private and the page returns a 404 within a minute." },
  { key: "sharing", p: "When you share a List with someone, we keep the email address you typed so that person can sign in and see it, and we send them one email to say so. They see the List as a public page shows it: titles, sites, covers and your notes on the List, never your tags, ticks or the pages we kept. Remove them, delete the List or delete your account and the address goes too." },
  { key: "emailIn", p: "Mail sent to your pluck+ address becomes an item. We keep the message body as the item's page text and the sender as its site. We don't use that address for anything else." },
  { id: "cookies", key: "cookies", p: "Two cookies are always on, because Pluck needs them: one keeps you signed in, and one holds what you paste on the home page for a day until you sign up. A third is up to you, and we ask before it is set. Say “Pluck it, I'm in” and we use PostHog, in the EU, to see how Pluck gets used: the pages you open, what you click, and once you are signed in, which account it was. It never sees what you pluck: button and link text, page titles and search words are stripped before anything leaves your browser. Say “Pluck off” and none of that happens. Either way, when something breaks we send the error and where it happened, with nothing that says who you are, so we can fix it. Change your mind any time from Cookies at the bottom of the site or in Settings. The iPhone app asks the same question once and has the same switch in its Settings." },
  { key: "where", p: "Our hosted service runs on Vercel, MongoDB Atlas and AWS, all in Ireland, and PostHog in the EU for the analytics and error reports above. If you self-host, nothing touches our servers at all." },
  { key: "export", p: "Export everything as JSON and Markdown from Settings, any time. Delete your account from Settings and every item, tag, list, note and key is gone at once. Backups are purged within 30 days." },
  { key: "rights", p: "You can ask for a copy of your data, correct it, or have it erased. Export and Delete in Settings do this without asking us. If you need something else, email us. You can also complain to the Data Protection Commission in Ireland." },
] as const;

export default async function Privacy() {
  const t = await getTranslations("site.legal.privacy");
  return (
    <LegalPage
      page="privacy"
      title={t("title")}
      lede="Short version: we store what you pluck so you can read it later. We don't read it, sell it, or feed it to a model. Last updated 24 October 2026."
      sections={SECTIONS.map((x) => ({ ...x, h: t(`sections.${x.key}`) }))}
      box={{ title: t("box"), body: "Email privacy@getpluck.io and we answer within 30 days. The company behind Pluck is Codú Limited, Ireland." }}
    />
  );
}
