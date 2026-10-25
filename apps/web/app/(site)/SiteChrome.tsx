import { Logo } from "@pluck/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { CookiesLink } from "@/components/CookieBanner";
import { LanguageSelect } from "@/components/LanguageSelect";
import { REPO_URL } from "@/lib/site";
import styles from "./site.module.css";

type Page = "home" | "chrome" | "iphone" | "connect" | "open-source" | "support" | "privacy" | "terms";

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
        <div className={styles.footerInner}>
          {footerNote ? <span className={styles.footerNote}>{footerNote}</span> : <span className={styles.footerBrand}><Logo size={18} /></span>}
          {page !== "home" && <Link href="/">{t("footerHome")}</Link>}
          {page !== "connect" && <Link href="/connect">{t("connect")}</Link>}
          {page !== "open-source" && <Link href="/open-source">{t("openSource")}</Link>}
          {page === "home" && <a href={REPO_URL}>GitHub</a>}
          {page !== "support" && <Link href="/support">{t("support")}</Link>}
          {page !== "privacy" && <Link href="/privacy">{t("privacy")}</Link>}
          {page !== "terms" && <Link href="/terms">{t("terms")}</Link>}
          <CookiesLink className={styles.footerButton}>{t("cookies")}</CookiesLink>
          <LanguageSelect namespace="site" className={styles.footerLanguage} />
        </div>
      </footer>
    </div>
  );
}
