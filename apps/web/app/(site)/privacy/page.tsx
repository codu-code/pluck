import type { Metadata } from "next";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Privacy · Pluck", description: "What Pluck stores, what it never does, and how to take it all with you." };

const SECTIONS = [
  { h: "What we store", p: "Your email and name. Every item you pluck: the link, the page text and images we fetched, your title, note, tags, kind, status, lists, highlights and reading position. The time you plucked it and the time you last opened it, which the expiry rule and the Monday email use. Items you import from Pocket, Omnivore, Raindrop or a bookmarks file." },
  { h: "What we don't do", p: "We don't read your library. No person looks at it unless you ask us to for support. We don't sell it or share it with advertisers. There are no ads. The app has no AI model inside it, so nothing you pluck is sent to a model by us." },
  { h: "The browser extension", p: "While you are signed in, the extension asks your Pluck server whether the page you are on is already in your library, so its icon can fill in. That address is only used to answer the question: it is not added to your library or kept with your account. Turn it off by signing out of the extension or removing it." },
  { h: "Your AI tool", p: "If you connect an AI tool over MCP, that tool reads your library on your behalf and sends what it reads to its own provider. That is between you and them. You can disconnect it at any time in Settings. Everything the tool changes is marked as changed by AI and can be undone in bulk." },
  { h: "Public lists", p: "A list is private until you make it public. A public list shows its name, purpose, your name and handle, each item's title, cover, site and your note, with links out to the originals. It never shows the stored page text, your tags, ticks or anything else in your library. Flip it back to private and the page returns a 404 within a minute." },
  { h: "Email-in", p: "Mail sent to your pluck+ address becomes an item. We keep the message body as the item's page text and the sender as its site. We don't use that address for anything else." },
  { h: "Cookies and analytics", p: "One cookie, to keep you signed in. If you paste a link on the home page before you have an account, a second cookie holds it for a day so it is waiting when you sign up. No tracking cookies, no third-party analytics." },
  { h: "Where it lives", p: "Our hosted service runs on Vercel, MongoDB Atlas and AWS, all in Ireland. If you self-host, nothing touches our servers at all." },
  { h: "Export and delete", p: "Export everything as JSON and Markdown from Settings, any time. Delete your account from Settings and every item, tag, list, note and key is gone at once. Backups are purged within 30 days." },
  { h: "Your rights", p: "You can ask for a copy of your data, correct it, or have it erased. Export and Delete in Settings do this without asking us. If you need something else, email us. You can also complain to the Data Protection Commission in Ireland." },
];

export default function Privacy() {
  return (
    <LegalPage
      page="privacy"
      title="Privacy"
      lede="Short version: we store what you pluck so you can read it later. We don't read it, sell it, or feed it to a model. Last updated 24 October 2026."
      sections={SECTIONS}
      box={{ title: "Questions", body: "Email privacy@getpluck.io and we answer within 30 days. The company behind Pluck is Codú Limited, Ireland." }}
    />
  );
}
