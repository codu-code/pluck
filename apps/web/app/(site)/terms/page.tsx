import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LICENCE } from "@/lib/site";
import { LegalPage } from "../LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.legal.terms.meta");
  return { title: t("title"), description: t("description") };
}

// The legal text stays in English, which governs; the headings are translated (site.legal).
const SECTIONS = [
  { key: "service", p: `Pluck lets you pluck links, notes, todos and things, read them later, put them in lists, and connect an AI tool to your library over MCP. The hosted service at getpluck.io is free. The code is open source under ${LICENCE}, and you may run your own copy.` },
  { key: "account", p: "You need to be 16 or over. Keep your sign-in and API keys to yourself. You are responsible for what is done with them. One person, one account." },
  { key: "library", p: "You own what you pluck and what you write. We claim no rights over it. We store and show it to you, and to others only where you make a list public. You can export it all at any time." },
  { key: "publicLists", p: "When you make a list public you are publishing it. You confirm you have the right to share each item's title, cover, site and your own note. Don't publish lists that contain or point to illegal content, material that sexualises minors, threats, harassment, doxxing, spam, malware, or content that infringes someone else's copyright or trademark. We may take down a public list that breaks these rules, and may close accounts that keep doing it. Taking a list down does not delete it from your library." },
  { key: "stored", p: "Pluck keeps a private copy of pages you pluck so you can read them later, the way a browser cache does. That copy is for you alone and is never served publicly. If a rights holder asks us to remove a stored copy of their page, we will." },
  { key: "fairUse", p: "Don't use Pluck to scrape sites at scale, to run a bot farm, or to store things that aren't yours to store. We rate-limit capture, API and MCP calls to keep the service fast for everyone. Limits are published in the docs and we will tell you if you hit them." },
  { key: "ai", p: "Connecting an AI tool is your choice. What that tool does with your library is governed by its own terms. We expose read tools and write tools that mark their changes. A delete tool exists only if you grant it separately, and we never ask for it by default. We are not responsible for what a third-party tool does." },
  { key: "wayOut", p: "The hosted service is free and provided as is. We will do our best to keep it fast and up, but we can't guarantee it, and we can't guarantee it runs for ever. If we ever have to stop, we will give at least 90 days' notice, keep Export working to the last day, and the self-host option will always exist. Our liability to you is limited to the amount you paid us, which is nothing." },
  { key: "law", p: "We may update these terms. We'll post the date at the top and email you for anything that matters. These terms are governed by the law of Ireland." },
] as const;

export default async function Terms() {
  const t = await getTranslations("site.legal.terms");
  return (
    <LegalPage
      page="terms"
      title={t("title")}
      lede="Short version: it's your library, be decent with public lists, and we can't promise the free service lasts for ever, which is why you can export and self-host. Last updated 24 October 2026."
      sections={SECTIONS.map((x) => ({ ...x, h: t(`sections.${x.key}`) }))}
      box={{ title: t("box"), body: "Every public page has a Report link at the bottom. Or email support@getpluck.io with the link. We act within 3 working days." }}
    />
  );
}
