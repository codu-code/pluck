import { fromIntlLocale } from "@pluck/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SitePage } from "./SiteChrome";
import styles from "./site.module.css";

// Privacy and Terms share one shape: a title, the short version, numbered-free sections, and a box at the end.
// The English governs, so a translated page says so at the top.
export async function LegalPage({ page, title, lede, sections, box }: {
  page: "privacy" | "terms";
  title: string;
  lede: string;
  sections: { key: string; h: string; p: ReactNode; id?: string }[];
  box: { title: string; body: ReactNode };
}) {
  const t = await getTranslations("site");
  const translated = fromIntlLocale(await getLocale()) !== "en";
  return (
    <SitePage page={page} footerNote={t("chrome.freeAndOpen")}>
      <div className={styles.legal}>
        <div className={styles.legalHead}>
          <h1 className={`${styles.display} ${styles.legalTitle}`}>{title}</h1>
          {translated && <p className={styles.legalNote}>{t("legal.translationNotice")}</p>}
          <p className={styles.legalLede}>{lede}</p>
        </div>
        {sections.map((s) => (
          <section key={s.key} id={s.id} className={styles.legalSection}>
            <h2>{s.h}</h2>
            <p>{s.p}</p>
          </section>
        ))}
        <section className={styles.legalBox}>
          <b>{box.title}</b>
          <span>{box.body}</span>
        </section>
      </div>
    </SitePage>
  );
}
