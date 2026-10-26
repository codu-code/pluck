import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser, HOST, MCP_RESOURCE } from "@/lib/auth";
import { aiTaggedCount, aiToolsOf, archiveItAll, emailInAddress, keysOf, listsOf, me, tagsOf } from "@/lib/library";
import { CookiesLink } from "@/components/CookieBanner";
import { LanguageSelect } from "@/components/LanguageSelect";
import { DeleteAccount, ImportExport, KeysSection, SignOut } from "./AccountSections";
import { AiToolsSection } from "./AiToolsSection";
import { EmailInSection } from "./EmailInSection";
import { ExpirySection } from "./ExpirySection";
import { ProfileSection } from "./ProfileSection";
import { TagsSection } from "./TagsSection";
import styles from "./settings.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("settings") };
}

// Settings from the board, top to bottom.
export default async function Settings() {
  const user = await requireUser();
  const [tags, aiWeek, profile, stale, address, keys, aiTools, lists] = await Promise.all([
    tagsOf(user.id), aiTaggedCount(user.id, 7), me(user.id), archiveItAll(user.id, { dryRun: true }), emailInAddress(user.id), keysOf(user.id),
    aiToolsOf(user.id), listsOf(user.id),
  ]);
  const t = await getTranslations("app");
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>{t("settings.title")}</h1>
        <span className={styles.meta}>
          {user.email} · {t("settings.signedIn")} · <SignOut /> · <CookiesLink className={styles.linkButton} />
        </span>
      </div>
      <ProfileSection initial={profile} publicLists={lists.filter((l) => l.visibility === "public").length} host={HOST} />
      <AiToolsSection connectorUrl={MCP_RESOURCE} keyPrefix={keys[0]?.prefix ?? null} initial={aiTools} lastCallAt={profile.lastMcpCallAt} />
      <div className={styles.pair}>
        <EmailInSection initial={address} />
        <KeysSection initial={keys} />
      </div>
      <section id="language" className={styles.sectionPlain}>
        <h2 className={styles.h2}>{t("language.label")}</h2>
        <p className={styles.meta}>{t("language.hint")}</p>
        <LanguageSelect namespace="app" account className={styles.language} />
      </section>
      <ExpirySection initial={profile.settings} staleCount={stale.count} />
      <TagsSection initial={tags} aiWeek={aiWeek} />
      <ImportExport initialImport={null} />
      <DeleteAccount email={user.email} />
    </div>
  );
}
