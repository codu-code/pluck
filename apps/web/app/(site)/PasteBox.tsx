"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./site.module.css";

type Result = { signedIn: boolean; count: number; ms: number };

// The live paste box. A visitor's links are held for a day and become theirs when they sign up;
// someone signed in plucks for real.
export function PasteBox() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      {error ? (
        <span role="alert" className={styles.pasteError}>{error}</span>
      ) : result ? (
        <div role="status" className={styles.plucked}>
          <span className={styles.tickSmall} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#151A13" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <b>Plucked.</b>
          {result.signedIn ? (
            <span className={styles.pluckedNote}>It's in your <Link href="/inbox">Inbox</Link>.</span>
          ) : (
            <span className={styles.pluckedNote}>That was {result.ms} ms. <Link href="/signin">Sign up to keep it</Link>.</span>
          )}
        </div>
      ) : (
        <span className={styles.pasteHint}>Free. Open source. iPhone, Chrome, Firefox, web and email. Ready for your AI.</span>
      )}
    </div>
  );
}
