import type { Metadata } from "next";
import Link from "next/link";
import { CLONE_URL, LICENCE, REPO_URL } from "@/lib/site";
import { SitePage } from "../SiteChrome";
import styles from "../site.module.css";

export const metadata: Metadata = {
  title: "Open source · Pluck",
  description: "Pluck is free and open source. Use getpluck.io, or run your own in one command.",
};

const REASONS = [
  { h: "Export in one click.", p: "Every item as JSON, plus one Markdown file per item and per list, with your highlights and notes. It works on day one, not when we get round to it." },
  { h: "The page, not just the link.", p: "Pluck keeps what you plucked. When the site goes down or changes, your copy is still there, readable." },
  { h: "Public means public. Private means private.", p: "A public list shows titles, covers, your notes and links out. It never serves the stored page text. Flip it back to private and the page is gone within a minute." },
  { h: "Your AI, your call.", p: "Pluck never sends what you pluck to a model on its own. Your AI tool reads your library only when you connect it, and only does what you ask." },
];

export default function OpenSource() {
  return (
    <SitePage page="open-source" footerNote={`Licence: ${LICENCE}. Made in Dublin.`}>
      <section className={`${styles.wrap} ${styles.pageHero}`}>
        <h1 className={`${styles.display} ${styles.openTitle}`}>Free.<br />Open.<br /><span className={styles.marker}>Yours.</span></h1>
        <p className={styles.heroPara}>Read-it-later apps keep closing. Pluck can't, because the code is public and the data is yours. Use ours, or run your own in one command.</p>
      </section>

      <section className={`${styles.wrap} ${styles.selfHost}`}>
        <div className={styles.selfHostCopy}>
          <h2 className={`${styles.display} ${styles.h2Section}`}>Self-host in one command.</h2>
          <p className={styles.selfHostPara}>The same app, extension, iPhone app and AI connector. Point them at your server in Settings.</p>
        </div>
        <div className={`${styles.terminal} ${styles.mono}`}>
          <span className={styles.comment}># {REPO_URL}</span>
          <span>git clone {CLONE_URL}</span>
          <span>cd pluck</span>
          <span className={styles.mint}>docker compose up -d</span>
          <span className={`${styles.comment} ${styles.gap}`}># then, for AI tools without a public URL</span>
          <span>npx @pluck/mcp --server http://localhost:3000 --key pk_live_…</span>
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.reasons}`}>
        <div className={styles.reasonList}>
          {REASONS.map((r) => (
            <div key={r.h} className={styles.reason}>
              <b className={styles.display}>{r.h}</b>
              <p>{r.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.wrap} ${styles.closingRow}`}>
        <p className={`${styles.display} ${styles.closingMid}`}>Pluck it<span className={styles.dot}>.</span></p>
        <div className={styles.buttons} style={{ gap: 10 }}>
          <Link href="/signin" className={`${styles.big} ${styles.bigPrimary}`}>Use getpluck.io</Link>
          <a href={REPO_URL} className={`${styles.big} ${styles.bigOutline}`}>Read the code</a>
        </div>
      </section>
    </SitePage>
  );
}
