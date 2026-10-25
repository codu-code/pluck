"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Actions, Dot, Stamp, Standalone, standaloneStyles as s } from "@/components/Standalone";

type State = "idle" | "sending" | "sent" | "resending" | "error" | "limited" | "wrong";

// What lands in their inbox, drawn: so the next step is no surprise.
function EmailPreview({ sent }: { sent: boolean }) {
  const t = useTranslations("app.signin.preview");
  return (
    <div className={s.panel}>
      {sent && <Stamp>{t("sent")}</Stamp>}
      <div className={s.panelHead}><b>Pluck</b><span>{t("subject")}</span><time>{t("now")}</time></div>
      <div className={s.panelBody}>
        <span className={s.panelTitle}>{t("title")}</span>
        <p>{t("body")}</p>
        <span className={s.panelButton}>{t("button")}</span>
      </div>
    </div>
  );
}

export function SignInForm({ next = "/inbox", forAiTool = false }: { next?: string; forAiTool?: boolean }) {
  const t = useTranslations("app.signin");
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
        title={<>{t("sent.title")}<Dot /></>}
        lede={t.rich("sent.lede", { email, b: (c) => <b>{c}</b> })}
        art={<EmailPreview sent />}
      >
        <p className={s.srOnly} role="status">{t("sent.status", { email })}</p>
        <Actions>
          <button type="button" className={s.secondary} disabled={state === "resending"} onClick={() => void send()}>
            {state === "resending" ? t("sent.sending") : t("sent.again")}
          </button>
          <button type="button" className={`${s.textLink} ${s.linkButton}`} onClick={() => setState("idle")}>{t("sent.different")}</button>
        </Actions>
        <p className={s.small}>{t("sent.spam")}</p>
      </Standalone>
    );
  }

  return (
    <Standalone
      title={forAiTool ? <>{t("aiTitle")}<Dot /></> : [t("title1"), <>{t("title2")}<Dot /></>]}
      lede={forAiTool ? t("aiLede") : t("lede")}
      art={<EmailPreview sent={false} />}
    >
      <form className={s.form} onSubmit={submit}>
        <label className={s.field}>
          <span className={s.label}>{t("email")}</span>
          <input
            className={s.input}
            type="email"
            name="email"
            required
            autoComplete="email"
            autoFocus
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setPassword(null);
            }}
          />
        </label>
        {password !== null && (
          <label className={s.field}>
            <span className={s.label}>{t("password")}</span>
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
          {password !== null ? (state === "sending" ? t("signingIn") : t("signIn")) : state === "sending" ? t("sending") : t("send")}
        </button>
        {state === "error" && (
          <p className={s.error} role="alert">{t("error")}</p>
        )}
        {state === "wrong" && <p className={s.error} role="alert">{t("wrong")}</p>}
        {state === "limited" && (
          <p className={s.error} role="alert">
            {password !== null ? t("limitedTries") : t("limitedLinks")}
          </p>
        )}
      </form>
    </Standalone>
  );
}
