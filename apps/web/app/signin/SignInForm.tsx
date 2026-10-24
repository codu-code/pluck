"use client";

import { useState, type FormEvent } from "react";
import styles from "./signin.module.css";

export function SignInForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [email, setEmail] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: "/inbox" }),
    });
    setState(res.ok ? "sent" : "error");
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
    </form>
  );
}
