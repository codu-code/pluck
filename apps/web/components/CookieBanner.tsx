"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { analyticsOn, CONSENT_EVENT, OPEN_COOKIES_EVENT, readConsent, setConsent, startAnalytics, type Consent } from "@/lib/analytics";
import styles from "./cookie-banner.module.css";

// The Cookies board: asked once a year, two buttons of the same size, nothing pre-ticked. Shown only when this copy
// of Pluck has analytics at all (NEXT_PUBLIC_POSTHOG_KEY); "Cookies" links ask again.
export function CookieBanner() {
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState<Consent | null>(null);
  const t = useTranslations("app.cookies");

  useEffect(() => {
    if (!analyticsOn) return;
    startAnalytics();
    if (readConsent() === null) setAsking(true);
    const open = () => setAsking(true);
    window.addEventListener(OPEN_COOKIES_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIES_EVENT, open);
  }, []);

  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setSaid(null), 3000);
    return () => clearTimeout(t);
  }, [said]);

  const answer = (a: Consent) => {
    setConsent(a);
    setAsking(false);
    setSaid(a);
  };

  if (said) {
    return (
      <div role="status" className={styles.toast}>
        <span className={styles.tick} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <b>{said === "no" ? t("no.title") : t("yes.title")}</b>
        <span className={styles.toastNote}>{said === "no" ? t("no.note") : t("yes.note")}</span>
      </div>
    );
  }
  if (!asking) return null;
  return (
    <section aria-labelledby="cookie-title" className={styles.banner}>
      <div className={styles.top}>
        <Cookie />
        <div className={styles.copy}>
          <h2 id="cookie-title" className={styles.title}>{t("title")}<span className={styles.mark}>?</span></h2>
          <p className={styles.body}>
            {t("body")}
          </p>
        </div>
      </div>
      <div className={styles.buttons}>
        <button type="button" className={styles.no} onClick={() => answer("no")}>{t("no.button")}</button>
        <button type="button" className={styles.yes} onClick={() => answer("yes")}>{t("yes.button")}</button>
      </div>
      <Link href="/privacy#cookies" className={styles.more}>{t("more")}</Link>
    </section>
  );
}

// "Cookies" in a footer or Settings: asks again.
export function CookiesLink({ className, children }: { className?: string; children?: string }) {
  const t = useTranslations("app.cookies");
  if (!analyticsOn) return null;
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIES_EVENT))}>{children ?? t("link")}</button>;
}

// Reads the answer for screens that show it (Settings), kept current as it changes.
export function useConsent(): Consent | null {
  const [c, setC] = useState<Consent | null>(null);
  useEffect(() => {
    const read = () => setC(readConsent());
    read();
    window.addEventListener(CONSENT_EVENT, read);
    return () => window.removeEventListener(CONSENT_EVENT, read);
  }, []);
  return c;
}

// The drawn cookie from the board, with a bite out of it and the logo's three sparks for crumbs.
const Cookie = () => (
  <svg className={styles.cookie} width="72" height="72" viewBox="-2 -14 96 96" aria-hidden="true">
    <defs>
      <mask id="cookie-bite">
        <rect width="80" height="80" fill="#fff" />
        <circle cx="70" cy="14" r="14" fill="#000" /><circle cx="58" cy="6" r="9" fill="#000" /><circle cx="76" cy="27" r="9" fill="#000" />
      </mask>
    </defs>
    <g mask="url(#cookie-bite)">
      <circle cx="38" cy="42" r="32" fill="#C98B4F" />
      <circle cx="38" cy="42" r="32" fill="none" stroke="#A86D37" strokeWidth="2.5" />
      <path d="M22 30c2-3 6-3 7 0s-1 5-4 5-4-2-3-5zM40 50c2-3 7-2 7 1s-3 5-5 5-4-3-2-6zM24 52c1-2 4-2 5 0s0 4-3 4-3-2-2-4zM46 30c1-2 4-2 5 0s0 4-3 4-3-2-2-4zM34 40c1-2 3-2 4 0s0 3-2 3-3-1-2-3zM54 46c1-2 4-2 4 0s0 4-2 4-3-2-2-4z" fill="#3B2A1C" />
    </g>
    <g className={styles.crumbs} fill="none" stroke="#34A07C" strokeWidth="3.4" strokeLinecap="round">
      <path d="M80 30l4.6 2" /><path d="M84 15l5-1.2" /><path d="M73 1l2.4-4.4" />
    </g>
  </svg>
);
