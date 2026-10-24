import type { ReactNode } from "react";
import { SitePage } from "./SiteChrome";
import styles from "./site.module.css";

// Privacy and Terms share one shape: a title, the short version, numbered-free sections, and a box at the end.
export function LegalPage({ page, title, lede, sections, box }: {
  page: "privacy" | "terms";
  title: string;
  lede: string;
  sections: { h: string; p: string }[];
  box: { title: string; body: ReactNode };
}) {
  return (
    <SitePage page={page} footerNote="Pluck is free and open source. Made in Dublin.">
      <main className={styles.legal}>
        <div className={styles.legalHead}>
          <h1 className={`${styles.display} ${styles.legalTitle}`}>{title}</h1>
          <p className={styles.legalLede}>{lede}</p>
        </div>
        {sections.map((s) => (
          <section key={s.h} className={styles.legalSection}>
            <h2>{s.h}</h2>
            <p>{s.p}</p>
          </section>
        ))}
        <section className={styles.legalBox}>
          <b>{box.title}</b>
          <span>{box.body}</span>
        </section>
      </main>
    </SitePage>
  );
}
