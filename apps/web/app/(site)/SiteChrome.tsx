import { Logo } from "@pluck/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { CookiesLink } from "@/components/CookieBanner";
import { LanguageSelect } from "@/components/LanguageSelect";
import { REPO_URL } from "@/lib/site";
import styles from "./site.module.css";

type Page = "home" | "chrome" | "iphone" | "connect" | "open-source" | "support" | "privacy" | "terms" | "blog";

// Header and footer for the marketing pages (the boards' shared chrome).
export async function SitePage({ page, dark = false, footerNote, children }: { page: Page; dark?: boolean; footerNote?: ReactNode; children: ReactNode }) {
  const t = await getTranslations("site.chrome");
  const current = (p: Page) => (p === page ? "page" : undefined);
  return (
    <div className={`${styles.site} ${dark ? styles.dark : ""}`}>
      <header className={styles.header}>
        <Link href="/" aria-label={t("home")} className={styles.home}><Logo size={24} /></Link>
        <nav aria-label={t("nav")} className={styles.nav}>
          <Link href="/#lists">{t("lists")}</Link>
          <Link href="/connect" aria-current={current("connect")}>{t("connect")}</Link>
          <Link href="/open-source" aria-current={current("open-source")}>{t("openSource")}</Link>
          {page === "home" && <a href={REPO_URL}>GitHub</a>}
        </nav>
        <Link href="/signin" className={styles.cta}>{t("getPluck")}</Link>
      </header>
      <main>{children}</main>
      <footer className={styles.footer}>
        {/* The same links on every page, grouped by meaning; the page you're on is marked, not dropped. */}
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Link href="/" aria-label={t("home")} className={styles.home}><Logo size={22} /></Link>
            <p>{footerNote ?? t("tagline")}</p>
          </div>
          <ul className={styles.footerLinks}>
            <li><Link href="/connect" aria-current={current("connect")}>{t("connect")}</Link></li>
            <li><Link href="/open-source" aria-current={current("open-source")}>{t("openSource")}</Link></li>
            <li><a href={REPO_URL}>GitHub</a></li>
          </ul>
          <ul className={styles.footerLinks}>
            <li><Link href="/blog" aria-current={current("blog")}>{t("blog")}</Link></li>
            <li><Link href="/support" aria-current={current("support")}>{t("support")}</Link></li>
          </ul>
          <ul className={styles.footerLinks}>
            <li><Link href="/privacy" aria-current={current("privacy")}>{t("privacy")}</Link></li>
            <li><Link href="/terms" aria-current={current("terms")}>{t("terms")}</Link></li>
            <li><CookiesLink className={styles.footerButton}>{t("cookies")}</CookiesLink></li>
          </ul>
          <div className={styles.footerBase}>
            <LanguageSelect namespace="site" className={styles.footerLanguage} />
            <span>© {new Date().getFullYear()} Codú Limited</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
