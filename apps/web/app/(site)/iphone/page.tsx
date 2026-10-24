import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export const metadata: Metadata = {
  title: "Pluck for iPhone · Pluck",
  description: "Pluck for iPhone is on TestFlight first, then the App Store.",
};

// Where "iPhone" lands until the App Store listing is live (APP_STORE_URL in lib/site.ts).
export default function IPhone() {
  return (
    <SitePage page="iphone">
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <h1 className={`${styles.display} ${styles.supportTitle}`}>Soon<span className={styles.dot}>.</span></h1>
        <p className={styles.heroPara}>Pluck for iPhone is on TestFlight first, then the App Store. Pluck from the share sheet, read anywhere, swipe to Later.</p>
        <p className={styles.heroPara}>Until then, Pluck works in Safari on your phone: paste a link and it is plucked. Your AI can pluck for you too.</p>
        <div className={styles.buttons}>
          <Link href="/signin" className={`${styles.big} ${styles.bigPrimary}`}>Use it on the web</Link>
          <Link href="/connect" className={`${styles.big} ${styles.bigOutline}`}>Connect your AI</Link>
        </div>
      </section>
    </SitePage>
  );
}
