import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SitePage } from "./SiteChrome";
import styles from "./site.module.css";

// Privacy and Terms share one shape: a title, the short version, numbered-free sections, and a box at the end.
// The legal text itself stays in English, which governs; only the headings around it are translated.
export async function LegalPage({ page, title, lede, sections, box }: {
  page: "privacy" | "terms";
  title: string;
  lede: string;
  sections: { h: string; p: string; id?: string }[];
  box: { title: string; body: ReactNode };
}) {
  const t = await getTranslations("site");
  return (
    <SitePage page={page} footerNote={t("chrome.freeAndOpen")}>
      <main className={styles.legal}>
        <div className={styles.legalHead}>
          <h1 className={`${styles.display} ${styles.legalTitle}`}>{title}</h1>
          <p className={styles.legalNote}>{t("legal.englishOnly")}</p>
          <p className={styles.legalLede} lang="en">{lede}</p>
        </div>
        {sections.map((s) => (
          <section key={s.h} id={s.id} className={styles.legalSection}>
            <h2>{s.h}</h2>
            <p lang="en">{s.p}</p>
          </section>
        ))}
        <section className={styles.legalBox}>
          <b>{box.title}</b>
          <span lang="en">{box.body}</span>
        </section>
      </main>
    </SitePage>
  );
}
