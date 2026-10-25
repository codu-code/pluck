import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CLONE_URL, REPO_URL } from "@/lib/site";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.openSource.meta");
  return { title: t("title"), description: t("description") };
}

const REASONS = ["export", "page", "public", "ai"] as const;

export default async function OpenSource() {
  const t = await getTranslations("site.openSource");
  return (
    <SitePage page="open-source" footerNote={t("licence")}>
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <h1 className={`${styles.display} ${styles.openTitle}`}>{t.rich("title", { br: () => <br />, marker: (c) => <span className={styles.marker}>{c}</span> })}</h1>
        <p className={styles.heroPara}>{t("lede")}</p>
      </section>

      <section className={`${styles.wrap} ${styles.selfHost}`}>
        <div className={styles.selfHostCopy}>
          <h2 className={`${styles.display} ${styles.h2Section}`}>{t("selfHostTitle")}</h2>
          <p className={styles.selfHostPara}>{t("selfHostBody")}</p>
        </div>
        <div className={`${styles.terminal} ${styles.mono}`}>
          <span className={styles.comment}># {REPO_URL}</span>
          <span>git clone {CLONE_URL}</span>
          <span>cd pluck</span>
          <span className={styles.mint}>docker compose up -d</span>
          <span className={`${styles.comment} ${styles.gap}`}>{t("terminalComment")}</span>
          <span>npx @pluck/mcp --server http://localhost:3000 \</span>
          <span>  --key pk_live_…</span>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.reasons}`}>
        <div className={styles.reasonList}>
          {REASONS.map((r) => (
            <div key={r} className={styles.reason}>
              <b className={styles.display}>{t(`reasons.${r}.title`)}</b>
              <p>{t(`reasons.${r}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.closingRow}`}>
        <p className={`${styles.display} ${styles.closingMid}`}>{t.rich("closing", { dot: (c) => <span className={styles.dot}>{c}</span> })}</p>
        <div className={styles.buttons} style={{ gap: 10 }}>
          <Link href="/signin" className={`${styles.big} ${styles.bigPrimary}`}>{t("use")}</Link>
          <a href={REPO_URL} className={`${styles.big} ${styles.bigOutline}`}>{t("code")}</a>
        </div>
      </section>
    </SitePage>
  );
}
