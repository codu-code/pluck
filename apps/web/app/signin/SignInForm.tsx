"use client";

import { useState, type FormEvent } from "react";
import styles from "./signin.module.css";

export function SignInForm({ next = "/inbox" }: { next?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "limited">("idle");
  const [email, setEmail] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: next }),
    });
    setState(res.ok ? "sent" : res.status === 429 ? "limited" : "error");
  }

  if (state === "sent") {
    return (
      <p className={styles.sent} role="status">
        Check <b>{email}</b>. The link works once, for 10 minutes.
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button className={styles.button} type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending" : "Email me a link"}
      </button>
      {state === "error" && (
        <p className={styles.error} role="alert">
          That did not go through. Check the address and try again.
        </p>
      )}
      {state === "limited" && (
        <p className={styles.error} role="alert">
          Too many links asked for. Use the last one we sent, or try again later.
        </p>
      )}
    </form>
  );
}
