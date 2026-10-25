import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.soon.iphone.meta");
  return { title: t("title"), description: t("description") };
}

// Where "iPhone" lands until the App Store listing is live (APP_STORE_URL in lib/site.ts).
export default async function IPhone() {
  const t = await getTranslations("site.soon");
  return (
    <SitePage page="iphone">
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <h1 className={`${styles.display} ${styles.supportTitle}`}>{t.rich("title", { dot: (c) => <span className={styles.dot}>{c}</span> })}</h1>
        <p className={styles.heroPara}>{t("iphone.para1")}</p>
        <p className={styles.heroPara}>{t("iphone.para2")}</p>
        <div className={styles.buttons}>
          <Link href="/signin" className={`${styles.big} ${styles.bigPrimary}`}>{t("web")}</Link>
          <Link href="/connect" className={`${styles.big} ${styles.bigOutline}`}>{t("connect")}</Link>
        </div>
      </section>
    </SitePage>
  );
}
