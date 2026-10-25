"use client";

import { useState, type FormEvent } from "react";
import { Actions, Dot, Stamp, Standalone, standaloneStyles as s } from "@/components/Standalone";

type State = "idle" | "sending" | "sent" | "resending" | "error" | "limited" | "wrong";

// What lands in their inbox, drawn: so the next step is no surprise.
function EmailPreview({ sent }: { sent: boolean }) {
  return (
    <div className={s.panel}>
      {sent && <Stamp>Sent.</Stamp>}
      <div className={s.panelHead}><b>Pluck</b><span>Your link to Pluck</span><time>now</time></div>
      <div className={s.panelBody}>
        <span className={s.panelTitle}>Here is your link.</span>
        <p>Tap it to sign in. It works once, for 10 minutes. No password to remember, ever.</p>
        <span className={s.panelButton}>Sign in to Pluck</span>
      </div>
    </div>
  );
}

export function SignInForm({ next = "/inbox", forAiTool = false }: { next?: string; forAiTool?: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");
  // Set only when the server asks for one: App Review's account, which has no mailbox to open a link in.
  const [password, setPassword] = useState<string | null>(null);

  async function send() {
    setState(state === "sent" ? "resending" : "sending");
    const res = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: next }),
    }).catch(() => null);
    if (res?.ok && ((await res.json().catch(() => null)) as { password?: boolean } | null)?.password) {
      setPassword("");
      return setState("idle");
    }
    setState(res?.ok ? "sent" : res?.status === 429 ? "limited" : "error");
  }

  async function signInWithPassword() {
    setState("sending");
    const res = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    // A full load: `next` may be the OAuth request to carry on with, which the server answers.
    if (res?.ok) return window.location.assign(next);
    setState(res?.status === 401 ? "wrong" : res?.status === 429 ? "limited" : "error");
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void (password === null ? send() : signInWithPassword());
  };

  if (state === "sent" || state === "resending") {
    return (
      <Standalone
        title={<>Check your email<Dot /></>}
        lede={<>We sent a link to <b>{email}</b>. It works once, for 10 minutes, in the browser you open it in.</>}
        art={<EmailPreview sent />}
      >
        <p className={s.srOnly} role="status">Sent a link to {email}. Check your email.</p>
        <Actions>
          <button type="button" className={s.secondary} disabled={state === "resending"} onClick={() => void send()}>
            {state === "resending" ? "Sending" : "Send it again"}
          </button>
          <button type="button" className={`${s.textLink} ${s.linkButton}`} onClick={() => setState("idle")}>Use a different email</button>
        </Actions>
        <p className={s.small}>Nothing after a minute? Look in spam, then send it again.</p>
      </Standalone>
    );
  }

  return (
    <Standalone
      title={forAiTool ? <>Sign in to connect your AI<Dot /></> : ["One link.", <>No password<Dot /></>]}
      lede={forAiTool ? "We email you a link. Once you are in, you choose what your AI tool can do." : "Type your email and we send a link. It signs you in, or starts your library if you are new."}
      art={<EmailPreview sent={false} />}
    >
      <form className={s.form} onSubmit={submit}>
        <label className={s.field}>
          <span className={s.label}>Email</span>
          <input
            className={s.input}
            type="email"
            name="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setPassword(null);
            }}
          />
        </label>
        {password !== null && (
          <label className={s.field}>
            <span className={s.label}>Password</span>
            <input
              className={s.input}
              type="password"
              name="password"
              required
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button className={s.primary} type="submit" disabled={state === "sending"}>
          {password !== null ? (state === "sending" ? "Signing in" : "Sign in") : state === "sending" ? "Sending" : "Email me a link"}
        </button>
        {state === "error" && (
          <p className={s.error} role="alert">That did not go through. Check the address, then try again.</p>
        )}
        {state === "wrong" && <p className={s.error} role="alert">That password did not work.</p>}
        {state === "limited" && (
          <p className={s.error} role="alert">
            {password !== null ? "That is a lot of tries. Try again in an hour." : "That is a lot of links. Use the newest one we sent, or try again in an hour."}
          </p>
        )}
      </form>
    </Standalone>
  );
}
