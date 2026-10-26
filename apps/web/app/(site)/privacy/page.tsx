import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageAlternates } from "@/lib/site";
import { LegalPage } from "../LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.privacy.meta");
  return { title: t("title"), description: t("description"), alternates: await pageAlternates("/privacy") };
}

// Each section's heading and paragraph, by key under site.privacy.sections.
const SECTIONS = [
  { key: "store" }, { key: "dont" }, { key: "extension" }, { key: "ai" }, { key: "publicLists" }, { key: "sharing" },
  { key: "emailIn" }, { id: "cookies", key: "cookies" }, { key: "where" }, { key: "export" }, { key: "rights" },
] as const;

const EMAIL = "privacy@getpluck.io";

export default async function Privacy() {
  const t = await getTranslations("site.privacy");
  return (
    <LegalPage
      page="privacy"
      title={t("title")}
      lede={t("lede")}
      sections={SECTIONS.map((x) => ({ ...x, h: t(`sections.${x.key}.title`), p: t(`sections.${x.key}.body`) }))}
      box={{ title: t("box.title"), body: t.rich("box.body", { email: EMAIL, mail: (c) => <a href={`mailto:${EMAIL}`}>{c}</a> }) }}
    />
  );
}
