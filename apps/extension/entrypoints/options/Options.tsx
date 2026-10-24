import { useEffect, useState } from "react";
import { signOut, startSignIn, useApiKey } from "@/lib/auth";
import { get, set, settings as readSettings, type Settings } from "@/lib/store";

// Options (Extension board): the server, the default kind, the account, and what a pluck sends.
export function Options() {
  const [s, setS] = useState<Settings | null>(null);
  const [server, setServer] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [keyMode, setKeyMode] = useState(false);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
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

  const saveServer = async () => {
    let origin: string;
    try {
      origin = new URL(server.trim()).origin;
    } catch {
      return setMessage("That is not a web address.");
    }
    if (origin === s.server) return;
    // Only servers this build was made for (its host permissions); others need their own build.
    if (!(await browser.permissions.contains({ origins: [`${origin}/*`] })))
      return setMessage("This copy of Pluck only reaches its own server. To use yours, build the extension from the repo: see docs/self-host.md.");
    await signOut();
    await save({ server: origin });
    setServer(origin);
    setMessage(`Using ${origin}. Sign in there to pluck.`);
  };

  return (
    <main className="options">
      <div className="options-head">
        <h1>Pluck options</h1>
        <span className="meta">Shortcut: Alt+Shift+P · change it in your browser's shortcuts page</span>
      </div>
      <div className="grid">
        <label className="field">
          <span className="strong">Server</span>
          <input type="url" value={server} onChange={(e) => setServer(e.target.value)} onBlur={() => void saveServer()} onKeyDown={(e) => e.key === "Enter" && void saveServer()} />
        </label>
        <label className="field">
          <span className="strong">Default kind</span>
          <select value={s.defaultKind} onChange={(e) => void save({ defaultKind: e.target.value as Settings["defaultKind"] })}>
            <option value="guess">Guess from the page</option>
            <option value="link">Read</option>
            <option value="video">Watch</option>
          </select>
        </label>
        <div className="field">
          <span className="strong">Account</span>
          {keyMode ? (
            <form
              className="account"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await useApiKey(key);
                setMessage(ok ? "Signed in with your API key." : "That key did not work on this server.");
                if (ok) setKeyMode(false);
              }}
            >
              <input type="password" aria-label="API key" placeholder="pk_live_…" value={key} onChange={(e) => setKey(e.target.value)} />
              <button type="submit" className="link">Use key</button>
            </form>
          ) : (
            <span className="account">
              {email ?? "Not signed in"}
              <span className="links">
                {email ? (
                  <button type="button" className="link" onClick={async () => { await signOut(); setMessage("Signed out."); }}>Sign out</button>
                ) : (
                  <button type="button" className="link" onClick={() => void startSignIn()}>Sign in</button>
                )}
                <button type="button" className="link" onClick={() => setKeyMode(true)}>Use an API key instead</button>
              </span>
            </span>
          )}
        </div>
        <div />
        <label className="check">
          <input type="checkbox" checked={s.sendContent} onChange={(e) => void save({ sendContent: e.target.checked })} />
          <span className="stack">
            <span className="strong">Send page content with plucks</span>
            <span className="meta">So pages behind your logins are readable later.</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.transcripts} onChange={(e) => void save({ transcripts: e.target.checked })} />
          <span className="stack">
            <span className="strong">Capture YouTube transcripts</span>
            <span className="meta">So search and your AI can read what was said.</span>
          </span>
        </label>
      </div>
      {message && <p role="status" className="meta">{message}</p>}
    </main>
  );
}
