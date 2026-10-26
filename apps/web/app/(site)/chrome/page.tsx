import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageAlternates } from "@/lib/site";
import Link from "@/components/SiteLink";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.soon.chrome.meta");
  return { title: t("title"), description: t("description"), alternates: await pageAlternates("/chrome") };
}

// Where "Add to Chrome" lands until the store listing is live (CHROME_STORE_URL in lib/site.ts).
export default async function Chrome() {
  const t = await getTranslations("site.soon");
  return (
    <SitePage page="chrome">
      <section className={`${styles.wrap} ${styles.pageHero} ${styles.soon}`}>
        <h1 className={`${styles.display} ${styles.supportTitle}`}>{t.rich("title", { dot: (c) => <span className={styles.dot}>{c}</span> })}</h1>
        <p className={styles.heroPara}>{t("chrome.para1")}</p>
        <p className={styles.heroPara}>{t("chrome.para2")}</p>
        <div className={styles.buttons}>
          <Link href="/signin" className={`${styles.big} ${styles.bigPrimary}`}>{t("web")}</Link>
          <Link href="/connect" className={`${styles.big} ${styles.bigOutline}`}>{t("connect")}</Link>
        </div>
      </section>
    </SitePage>
  );
}
