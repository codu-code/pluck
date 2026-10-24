import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export const metadata: Metadata = {
  title: "Pluck for Chrome · Pluck",
  description: "Pluck for Chrome is in the Chrome Web Store's review queue. Out any day now.",
};

// Where "Add to Chrome" lands until the store listing is live (CHROME_STORE_URL in lib/site.ts).
export default function Chrome() {
  return (
    <SitePage page="chrome">
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <h1 className={`${styles.display} ${styles.supportTitle}`}>Soon<span className={styles.dot}>.</span></h1>
        <p className={styles.heroPara}>Pluck for Chrome is in the Chrome Web Store's review queue, somewhere behind a few thousand coupon finders. Out any day now.</p>
        <p className={styles.heroPara}>Until then, Pluck works on the web: paste a link and it is plucked. Your AI can pluck for you too.</p>
        <div className={styles.buttons}>
          <Link href="/signin" className={`${styles.big} ${styles.bigPrimary}`}>Use it on the web</Link>
          <Link href="/connect" className={`${styles.big} ${styles.bigOutline}`}>Connect your AI</Link>
        </div>
      </section>
    </SitePage>
  );
}
