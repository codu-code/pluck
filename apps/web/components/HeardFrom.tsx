"use client";

import { HeardFrom as Choice } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { analyticsOn, CONSENT_EVENT, readConsent } from "@/lib/analytics";
import styles from "./cookie-banner.module.css";

const CHOICES = Choice.options.filter((c) => c !== "skipped");

// "How did you find Pluck?", once, after the first Pluck, on the cookie board's frame. It waits until the cookie
// question is answered, so the two never stack. Hosted only (analyticsOn): a self-hosted copy has nobody to ask for.
export function HeardFromPrompt({ ask }: { ask: boolean }) {
  const t = useTranslations("app.heardFrom");
  const [open, setOpen] = useState(false);
  const [thanked, setThanked] = useState(false);
  const [done, setDone] = useState(false); // answered on this page: a later cookie answer must not ask again

  useEffect(() => {
    if (!ask || done || !analyticsOn) return;
    const check = () => setOpen(readConsent() !== null);
    check();
    window.addEventListener(CONSENT_EVENT, check);
    return () => window.removeEventListener(CONSENT_EVENT, check);
  }, [ask, done]);

  useEffect(() => {
    if (!thanked) return;
    const id = setTimeout(() => setThanked(false), 3000);
    return () => clearTimeout(id);
  }, [thanked]);

  const answer = (heardFrom: Choice) => {
    void fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ heardFrom }) }).catch(() => null);
    setOpen(false);
    setDone(true);
    setThanked(heardFrom !== "skipped");
  };

  if (thanked)
    return (
      <div role="status" className={styles.toast}>
        <span className={styles.tick} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <b>{t("thanks.title")}</b>
        <span className={styles.toastNote}>{t("thanks.note")}</span>
      </div>
    );
  if (!open) return null;
  return (
    <section aria-labelledby="heard-title" className={styles.banner}>
      <div className={styles.copy}>
        <h2 id="heard-title" className={styles.title}>{t("title")}<span className={styles.mark}>?</span></h2>
        <p className={styles.body}>{t("body")}</p>
      </div>
      <div className={styles.choices}>
        {CHOICES.map((c) => <button key={c} type="button" className={styles.no} onClick={() => answer(c)}>{t(`choices.${c}`)}</button>)}
      </div>
      <button type="button" className={styles.more} onClick={() => answer("skipped")}>{t("skip")}</button>
    </section>
  );
}
