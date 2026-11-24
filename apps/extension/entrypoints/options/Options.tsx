import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { signOut, startSignIn, useApiKey } from "@/lib/auth";
import { switchServer, typedServer } from "@/lib/server";
import { pageShortcut } from "@/lib/shortcut";
import { get, set, settings as readSettings, type Settings } from "@/lib/store";

// Options (Extension board): the server, the default kind, the account, and what a pluck sends.
export function Options() {
  const t = useTranslations("extension");
  const [s, setS] = useState<Settings | null>(null);
  const [server, setServer] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [keyMode, setKeyMode] = useState(false);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [keys, setKeys] = useState("");

  useEffect(() => {
    pageShortcut().then(setKeys);
    readSettings().then((x) => { setS(x); setServer(x.server); });
    get("email").then(setEmail);
    const onChange = (changes: Record<string, { newValue?: unknown }>) => changes.email && setEmail((changes.email.newValue as string | null) ?? null);
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, []);
  if (!s) return null;

  const save = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await set({ settings: next });
  };

  // Runs in the click or the Enter itself: the browser only asks for a new host while it is handling one.
  const confirmServer = () => {
    const typed = typedServer(server);
    if ("error" in typed) return setMessage(t(`options.messages.${typed.error}`));
    const { origin } = typed;
    setServer(origin);
    if (origin === s.server) return;
    setMessage(null); // the browser is asking: an earlier answer was not about this address
    void switchServer(s.server, origin).then((outcome) => {
      if (outcome === "using") setS((now) => now && { ...now, server: origin });
      setMessage(t(`options.messages.${outcome}`, { origin }));
    });
  };

  return (
    <main className="options">
      <div className="options-head">
        <h1>{t("options.title")}</h1>
        {keys && <span className="meta">{t("options.shortcut", { keys })}</span>}
      </div>
      <div className="grid">
        <div className="field">
          <label className="strong" htmlFor="server">{t("options.server")}</label>
          <input id="server" type="url" value={server} onChange={(e) => setServer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmServer()} />
          {server.trim() !== s.server && (
            <span className="links">
              <button type="button" className="link" onClick={confirmServer}>{t("options.useServer")}</button>
            </span>
          )}
        </div>
        <label className="field">
          <span className="strong">{t("options.defaultKind")}</span>
          <select value={s.defaultKind} onChange={(e) => void save({ defaultKind: e.target.value as Settings["defaultKind"] })}>
            <option value="guess">{t("options.guess")}</option>
            <option value="link">{t("kinds.link")}</option>
            <option value="video">{t("kinds.video")}</option>
          </select>
        </label>
        <div className="field">
          <span className="strong">{t("options.account")}</span>
          {keyMode ? (
            <form
              className="account"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await useApiKey(key);
                setMessage(ok ? t("options.messages.keySignedIn") : t("options.messages.keyFailed"));
                if (ok) setKeyMode(false);
              }}
            >
              <input type="password" aria-label={t("options.apiKey")} placeholder="pk_live_…" value={key} onChange={(e) => setKey(e.target.value)} />
              <button type="submit" className="link">{t("options.useKey")}</button>
            </form>
          ) : (
            <span className="account">
              {email ?? t("options.notSignedIn")}
              <span className="links">
                {email ? (
                  <button type="button" className="link" onClick={async () => { await signOut(); setMessage(t("options.messages.signedOut")); }}>{t("options.signOut")}</button>
                ) : (
                  <button type="button" className="link" onClick={() => void startSignIn()}>{t("options.signIn")}</button>
                )}
                <button type="button" className="link" onClick={() => setKeyMode(true)}>{t("options.useApiKey")}</button>
              </span>
            </span>
          )}
        </div>
        <div />
        <label className="check">
          <input type="checkbox" checked={s.sendContent} onChange={(e) => void save({ sendContent: e.target.checked })} />
          <span className="stack">
            <span className="strong">{t("options.sendContent")}</span>
            <span className="meta">{t("options.sendContentHint")}</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.transcripts} onChange={(e) => void save({ transcripts: e.target.checked })} />
          <span className="stack">
            <span className="strong">{t("options.transcripts")}</span>
            <span className="meta">{t("options.transcriptsHint")}</span>
          </span>
        </label>
      </div>
      {message && <p role="status" className="meta">{message}</p>}
    </main>
  );
}
