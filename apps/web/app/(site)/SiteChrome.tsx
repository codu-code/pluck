import { Logo } from "@pluck/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { REPO_URL } from "@/lib/site";
import styles from "./site.module.css";

type Page = "home" | "chrome" | "connect" | "open-source" | "support" | "privacy" | "terms";

// Header and footer for the marketing pages (the boards' shared chrome).
export function SitePage({ page, dark = false, footerNote, children }: { page: Page; dark?: boolean; footerNote?: ReactNode; children: ReactNode }) {
  const current = (p: Page) => (p === page ? "page" : undefined);
  return (
    <div className={`${styles.site} ${dark ? styles.dark : ""}`}>
      <header className={styles.header}>
        <Link href="/" aria-label="Pluck home" className={styles.home}><Logo size={24} /></Link>
        <nav aria-label="Site" className={styles.nav}>
          <Link href="/#lists">Lists</Link>
          <Link href="/connect" aria-current={current("connect")}>Connect your AI</Link>
          <Link href="/open-source" aria-current={current("open-source")}>Open source</Link>
          {page === "home" && <a href={REPO_URL}>GitHub</a>}
        </nav>
        <Link href="/signin" className={styles.cta}>Get Pluck</Link>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          {footerNote ? <span className={styles.footerNote}>{footerNote}</span> : <span className={styles.footerBrand}><Logo size={18} /></span>}
          {page !== "home" && <Link href="/">Home</Link>}
          {page !== "connect" && <Link href="/connect">Connect your AI</Link>}
          {page !== "open-source" && <Link href="/open-source">Open source</Link>}
          {page === "home" && <a href={REPO_URL}>GitHub</a>}
          {page !== "support" && <Link href="/support">Support</Link>}
          {page !== "privacy" && <Link href="/privacy">Privacy</Link>}
          {page !== "terms" && <Link href="/terms">Terms</Link>}
        </div>
      </footer>
    </div>
  );
}
