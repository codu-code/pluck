"use client";

import type { ApiKey, ImportStatus } from "@pluck/shared-schemas";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { when } from "@/lib/format";
import { clearLocal, signOutHere } from "@/lib/sign-out";
import styles from "./settings.module.css";
import { useNow } from "@/lib/use-now";

const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export function SignOut() {
  const router = useRouter();
  return (
    <button type="button" className={styles.linkButton} onClick={async () => { await signOutHere(); router.push("/signin"); }}>
      Sign out
    </button>
  );
}

// API keys (Settings board): for Claude Code, scripts, the Shortcut and self-hosting.
export function KeysSection({ initial }: { initial: ApiKey[] }) {
  const [keys, setKeys] = useState(initial);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const now = useNow();
  return (
    <section id="keys" className={styles.sectionPlain}>
      <h2 className={styles.h2}>API keys</h2>
      {fresh && (
        <div className={styles.freshKey} role="status">
          <b>Copy this key now. It is shown once.</b>
          <span className={styles.copyRow}>
            <code className={styles.code}>{fresh}</code>
            <button type="button" className={styles.inkButton} onClick={async () => { await navigator.clipboard?.writeText(fresh).catch(() => {}); showToast({ message: "Key copied." }); }}>Copy</button>
          </span>
        </div>
      )}
      {keys.map((k) => (
        <div key={k.id} className={styles.keyRow}>
          <span><b>{k.name}</b> <span className={styles.meta}>· pk_live_{k.prefix}•••• · {k.lastUsedAt ? `used ${now ? when(k.lastUsedAt, now) : ""}` : "not used yet"}</span></span>
          <button
            type="button"
            className={styles.small}
            onClick={async () => {
              if ((await send(`/api/v1/api-keys/${k.id}`, "DELETE")).ok) {
                setKeys((cur) => cur.filter((x) => x.id !== k.id));
                showToast({ message: `“${k.name}” revoked. It stops working now.` });
              }
            }}
          >
            Revoke
          </button>
        </div>
      ))}
      {naming ? (
        <form
          className={styles.copyRow}
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await send("/api/v1/api-keys", "POST", { name });
            if (!res.ok) return showToast({ message: "That did not go through." });
            const body = (await res.json()) as { key: string; apiKey: ApiKey };
            setKeys((cur) => [body.apiKey, ...cur]);
            setFresh(body.key);
            setNaming(false);
            setName("");
          }}
        >
          <input className={styles.profileInput} style={{ flex: 1 }} aria-label="Name for the key" placeholder="Claude Code on my laptop" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          <button type="submit" className={styles.inkButton} disabled={!name.trim()}>Make the key</button>
        </form>
      ) : (
        <button type="button" className={styles.inkButton} style={{ alignSelf: "flex-start" }} onClick={() => setNaming(true)}>New key</button>
      )}
      {toast}
    </section>
  );
}

const SOURCE_OF = (file: File): "pocket" | "omnivore" | "raindrop" | "html" | null => {
  const n = file.name.toLowerCase();
  if (n.endsWith(".zip")) return "omnivore";
  if (n.endsWith(".html") || n.endsWith(".htm")) return "html";
  if (n.endsWith(".csv")) return n.includes("raindrop") ? "raindrop" : "pocket";
  return null;
};

// Import and export (Settings board).
export function ImportExport({ initialImport }: { initialImport: ImportStatus | null }) {
  const [job, setJob] = useState(initialImport);
  const [fileName, setFileName] = useState<string | null>(null);
  const [source, setSource] = useState<"pocket" | "omnivore" | "raindrop" | "html">("pocket");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, showToast] = useToast();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!job || job.state === "done" || job.state === "failed") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/v1/imports/${job.id}`);
      if (res.ok) setJob(((await res.json()) as { import: ImportStatus }).import);
    }, 1500);
    return () => clearInterval(t);
  }, [job]);

  async function upload(file: File) {
    setError(null);
    const detected = SOURCE_OF(file);
    const src = detected === "pocket" && source === "raindrop" ? "raindrop" : (detected ?? source);
    setFileName(file.name);
    const begin = await send("/api/v1/imports", "POST", { source: src, size: file.size });
    if (!begin.ok) return setError("That did not go through.");
    const { import: rec, uploadUrl, contentType } = (await begin.json()) as { import: ImportStatus; uploadUrl: string; contentType: string };
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file });
    if (!put.ok) return setError("The upload did not go through. Try again.");
    const start = await send(`/api/v1/imports/${rec.id}/start`, "POST");
    if (start.ok) setJob(((await start.json()) as { import: ImportStatus }).import);
  }

  const pct = job && job.total ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;
  return (
    <div id="import" className={styles.pair}>
      <section className={styles.sectionPlain}>
        <h2 className={styles.h2}>Import</h2>
        <label className={styles.field}>
          <span className={styles.label}>From</span>
          <select className={styles.selectField} value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="pocket">Pocket (CSV)</option>
            <option value="omnivore">Omnivore (zip)</option>
            <option value="raindrop">Raindrop (CSV)</option>
            <option value="html">Browser bookmarks (HTML)</option>
          </select>
        </label>
        <label
          className={styles.drop}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void upload(f);
          }}
        >
          <span className={styles.dropTitle}>Drop a file, or choose one</span>
          <span className={styles.meta} style={{ fontSize: 13 }}>Pocket CSV · Omnivore zip · Raindrop CSV · bookmarks HTML</span>
          <input ref={input} type="file" className={styles.visuallyHidden} aria-label="Import file" accept=".csv,.zip,.html,.htm" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {error && <span role="alert" className={styles.error}>{error}</span>}
        {job && (
          <div className={styles.progressBlock}>
            <div className={styles.progressHead}>
              <span>{fileName ?? `${job.source} import`}</span>
              <span className={styles.meta}>
                {job.state === "failed" ? job.error : `${job.done.toLocaleString()} done${job.failed ? ` · ${job.failed.toLocaleString()} failed` : ""}`}
              </span>
            </div>
            <div className={styles.bar}><div className={styles.barFill} style={{ width: `${job.state === "done" ? 100 : pct}%` }} /></div>
            <span className={styles.meta} style={{ fontSize: 13 }}>
              {job.state === "done" ? "Done. Imported items are in your Archive under Imported, still searchable." : "Runs in the background. Close the page if you like."}
            </span>
          </div>
        )}
      </section>
      <section className={styles.sectionPlain}>
        <h2 className={styles.h2}>Export</h2>
        <p className={styles.meta}>pluck.json, plus one Markdown file per item with its text and notes, and one per list. A zip, by email. Any single list exports from its own page.</p>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            const res = await send("/api/v1/export", "POST");
            showToast({ message: res.ok ? "Exporting. The link arrives by email in a minute or two." : "That did not go through." });
          }}
        >
          {exporting ? "Exporting" : "Export everything"}
        </button>
      </section>
      {toast}
    </div>
  );
}

// Delete account (Settings board): type your email, then everything goes.
export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <section id="delete" className={styles.deleteSection}>
      <div className={styles.startText}>
        <h2 className={styles.h2}>Delete account</h2>
        <span className={styles.meta}>Every item, tag, note and key. Export first.</span>
      </div>
      {open ? (
        <form
          className={styles.deleteForm}
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await send("/api/v1/me", "DELETE", { confirm: typed });
            if (!res.ok) return setError(((await res.json()) as { error: { message: string } }).error.message);
            await clearLocal();
            router.push("/signin");
          }}
        >
          <label className={styles.field}>
            <span className={styles.label}>Type {email} to confirm</span>
            <input className={styles.profileInput} value={typed} autoFocus onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <button type="submit" className={styles.dangerButton} disabled={typed.trim().toLowerCase() !== email.toLowerCase()}>Delete everything now</button>
          <button type="button" className={styles.textButton} onClick={() => setOpen(false)}>Cancel</button>
          {error && <span role="alert" className={styles.error}>{error}</span>}
        </form>
      ) : (
        <button type="button" className={styles.dangerButton} onClick={() => setOpen(true)}>Delete everything. No, really.</button>
      )}
    </section>
  );
}
