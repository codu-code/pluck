"use client";

import { useTranslations } from "next-intl";
import Link from "@/components/SiteLink";
import { useState } from "react";
import styles from "./site.module.css";

type Result = { signedIn: boolean; count: number; ms: number };
type Keep = "idle" | "sending" | "sent" | "error" | "limited";

// The live paste box. A visitor's links are held for a day and become theirs when they sign up, which they can
// start right here: the email's link lands on /try/claim. Someone signed in plucks for real.
export function PasteBox() {
  const t = useTranslations("site.paste");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [keep, setKeep] = useState<Keep>("idle");

  async function sendLink() {
    setKeep("sending");
    const res = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: "/try/claim" }),
    }).catch(() => null);
    setKeep(res?.ok ? "sent" : res?.status === 429 ? "limited" : "error");
  }

  async function pluck() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const started = performance.now();
    const res = await fetch("/api/v1/try", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { signedIn: boolean; count: number; error?: { message: string } } | null;
    setBusy(false);
    if (!res?.ok || !body) return setError(body?.error?.message ?? t("failed"));
    setResult({ signedIn: body.signedIn, count: body.count, ms: Math.round(performance.now() - started) });
    setText("");
  }

  return (
    <div className={styles.paste}>
      <form className={styles.pasteBox} onSubmit={(e) => { e.preventDefault(); void pluck(); }}>
        <label htmlFor="try" className={styles.visuallyHidden}>{t("label")}</label>
        <input id="try" className={styles.pasteInput} type="text" inputMode="url" autoComplete="off" placeholder={t("placeholder")} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className={styles.pasteButton} disabled={busy}>{t("button")}</button>
      </form>
      {error && <span role="alert" className={styles.pasteError}>{error}</span>}
      {!error && result?.signedIn && (
        <div role="status" className={styles.plucked}>
          <span className={styles.tickSmall} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <b>{t("plucked")}</b>
          <span className={styles.pluckedNote}>{t.rich("inInbox", { inbox: (c) => <Link href="/inbox">{c}</Link> })}</span>
        </div>
      )}
      {result && !result.signedIn && (
        // A visitor keeps what they plucked without leaving the page: one panel, the email field inside it.
        <div className={styles.keep}>
          <div role="status" className={styles.keepStatus}>
            <span className={styles.keepHead}>
              <span className={styles.tickSmall} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
              <b>{keep === "sent" ? t("checkEmail") : t("plucked")}</b>
              {keep !== "sent" && <span className={styles.keepMs}>{t("took", { ms: result.ms })}</span>}
            </span>
            {keep === "sent" ? (
              <span className={styles.keepNote}>{t.rich("sent", { email, b: (c) => <b>{c}</b> })}</span>
            ) : (
              <span className={styles.keepNote}>{t("keepNote")}</span>
            )}
          </div>
          {keep !== "sent" && (
            <form className={styles.keepForm} onSubmit={(e) => { e.preventDefault(); void sendLink(); }}>
              <label htmlFor="keep" className={styles.visuallyHidden}>{t("emailLabel")}</label>
              <input id="keep" className={styles.pasteInput} type="email" required autoComplete="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className={styles.pasteButton} disabled={keep === "sending"}>{keep === "sending" ? t("sending") : t("keep")}</button>
            </form>
          )}
          {keep === "error" && <span role="alert" className={styles.keepError}>{t("emailFailed")}</span>}
          {keep === "limited" && <span role="alert" className={styles.keepError}>{t("limited")}</span>}
        </div>
      )}
      {!error && !result && <span className={styles.pasteHint}>{t("hint")}</span>}
    </div>
  );
}
