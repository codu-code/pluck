"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./site.module.css";

type Result = { signedIn: boolean; count: number; ms: number };
type Keep = "idle" | "sending" | "sent" | "error" | "limited";

// The live paste box. A visitor's links are held for a day and become theirs when they sign up, which they can
// start right here: the email's link lands on /try/claim. Someone signed in plucks for real.
export function PasteBox() {
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
    if (!res?.ok || !body) return setError(body?.error?.message ?? "That did not go through. Try again.");
    setResult({ signedIn: body.signedIn, count: body.count, ms: Math.round(performance.now() - started) });
    setText("");
  }

  return (
    <div className={styles.paste}>
      <form className={styles.pasteBox} onSubmit={(e) => { e.preventDefault(); void pluck(); }}>
        <label htmlFor="try" className={styles.visuallyHidden}>Paste a link to try it</label>
        <input id="try" className={styles.pasteInput} type="text" inputMode="url" autoComplete="off" placeholder="Paste a link. Or five. Go on." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className={styles.pasteButton} disabled={busy}>Pluck it</button>
      </form>
      {error && <span role="alert" className={styles.pasteError}>{error}</span>}
      {!error && result?.signedIn && (
        <div role="status" className={styles.plucked}>
          <span className={styles.tickSmall} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <b>Plucked.</b>
          <span className={styles.pluckedNote}>It's in your <Link href="/inbox">Inbox</Link>.</span>
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
              <b>{keep === "sent" ? "Check your email." : "Plucked."}</b>
              {keep !== "sent" && <span className={styles.keepMs}>That was {result.ms} ms.</span>}
            </span>
            {keep === "sent" ? (
              <span className={styles.keepNote}>We sent a link to <b>{email}</b>. Open it in this browser and your plucks land in your Inbox.</span>
            ) : (
              <span className={styles.keepNote}>Add your email to keep it. New or back, the link signs you in.</span>
            )}
          </div>
          {keep !== "sent" && (
            <form className={styles.keepForm} onSubmit={(e) => { e.preventDefault(); void sendLink(); }}>
              <label htmlFor="keep" className={styles.visuallyHidden}>Your email, to keep what you plucked</label>
              <input id="keep" className={styles.pasteInput} type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className={styles.pasteButton} disabled={keep === "sending"}>{keep === "sending" ? "Sending" : "Keep it"}</button>
            </form>
          )}
          {keep === "error" && <span role="alert" className={styles.keepError}>That did not go through. Check the address, then try again.</span>}
          {keep === "limited" && <span role="alert" className={styles.keepError}>That is a lot of links. Use the newest one we sent, or try again in an hour.</span>}
        </div>
      )}
      {!error && !result && <span className={styles.pasteHint}>Free. Open source. iPhone, Chrome, web and email. Ready for your AI.</span>}
    </div>
  );
}
