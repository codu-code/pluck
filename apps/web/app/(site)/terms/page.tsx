import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LICENCE, pageMeta } from "@/lib/site";
import { LegalPage } from "../LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.terms.meta");
  return { title: t("title"), description: t("description"), ...(await pageMeta("/terms")) };
}

// Each section's heading and paragraph, by key under site.terms.sections.
const SECTIONS = [
  { key: "service" }, { key: "account" }, { key: "library" }, { key: "publicLists" }, { key: "stored" },
  { key: "fairUse" }, { key: "ai" }, { key: "wayOut" }, { key: "law" },
] as const;

const EMAIL = "support@getpluck.io";

export default async function Terms() {
  const t = await getTranslations("site.terms");
  return (
    <LegalPage
      page="terms"
      title={t("title")}
      lede={t("lede")}
      sections={SECTIONS.map((x) => ({
        ...x,
        h: t(`sections.${x.key}.title`),
        p: x.key === "service" ? t("sections.service.body", { host: "getpluck.io", licence: LICENCE }) : t(`sections.${x.key}.body`),
      }))}
      box={{ title: t("box.title"), body: t.rich("box.body", { email: EMAIL, mail: (c) => <a href={`mailto:${EMAIL}`}>{c}</a> }) }}
    />
  );
}
