"use client";

import type { ApiKey, ImportStatus } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useFormat } from "@/components/useFormat";
import { clearLocal, signOutHere } from "@/lib/sign-out";
import styles from "./settings.module.css";
import { useNow } from "@/lib/use-now";

const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export function SignOut() {
  const router = useRouter();
  const t = useTranslations("app.settings");
  return (
    <button type="button" className={styles.linkButton} onClick={async () => { await signOutHere(); router.push("/signin"); }}>
      {t("signOut")}
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
  const t = useTranslations("app.settings.keys");
  const app = useTranslations("app.common");
  const f = useFormat();
  return (
    <section id="keys" className={styles.sectionPlain}>
      <h2 className={styles.h2}>{t("title")}</h2>
      {fresh && (
        <div className={styles.freshKey} role="status">
          <b>{t("fresh")}</b>
          <span className={styles.copyRow}>
            <code className={styles.code}>{fresh}</code>
            <button type="button" className={styles.inkButton} onClick={async () => { await navigator.clipboard?.writeText(fresh).catch(() => {}); showToast({ message: t("copied") }); }}>{app("copy")}</button>
          </span>
        </div>
      )}
      {keys.map((k) => (
        <div key={k.id} className={styles.keyRow}>
          <span><b>{k.name}</b> <span className={styles.meta}>· pk_live_{k.prefix}•••• · {k.lastUsedAt ? t("used", { when: now ? f.when(k.lastUsedAt, now) : "" }) : t("unused")}</span></span>
          <button
            type="button"
            className={styles.small}
            onClick={async () => {
              if ((await send(`/api/v1/api-keys/${k.id}`, "DELETE")).ok) {
                setKeys((cur) => cur.filter((x) => x.id !== k.id));
                showToast({ message: t("revoked", { name: k.name }) });
              }
            }}
          >
            {t("revoke")}
          </button>
        </div>
      ))}
      {naming ? (
        <form
          className={styles.copyRow}
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await send("/api/v1/api-keys", "POST", { name });
            if (!res.ok) return showToast({ message: app("didNotGoThrough") });
            const body = (await res.json()) as { key: string; apiKey: ApiKey };
            setKeys((cur) => [body.apiKey, ...cur]);
            setFresh(body.key);
            setNaming(false);
            setName("");
          }}
        >
          <input className={styles.profileInput} style={{ flex: 1 }} aria-label={t("nameLabel")} placeholder={t("namePlaceholder")} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          <button type="submit" className={styles.inkButton} disabled={!name.trim()}>{t("make")}</button>
        </form>
      ) : (
        <button type="button" className={styles.inkButton} style={{ alignSelf: "flex-start" }} onClick={() => setNaming(true)}>{t("new")}</button>
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
  const t = useTranslations("app.settings.import");
  const app = useTranslations("app.common");

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
    if (!begin.ok) return setError(app("didNotGoThrough"));
    const { import: rec, uploadUrl, contentType } = (await begin.json()) as { import: ImportStatus; uploadUrl: string; contentType: string };
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file });
    if (!put.ok) return setError(t("uploadFailed"));
    const start = await send(`/api/v1/imports/${rec.id}/start`, "POST");
    if (start.ok) setJob(((await start.json()) as { import: ImportStatus }).import);
  }

  const pct = job && job.total ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;
  return (
    <div id="import" className={styles.pair}>
      <section className={styles.sectionPlain}>
        <h2 className={styles.h2}>{t("title")}</h2>
        <label className={styles.field}>
          <span className={styles.label}>{t("from")}</span>
          <select className={styles.selectField} value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="pocket">{t("sources.pocket")}</option>
            <option value="omnivore">{t("sources.omnivore")}</option>
            <option value="raindrop">{t("sources.raindrop")}</option>
            <option value="html">{t("sources.html")}</option>
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
          <span className={styles.dropTitle}>{t("drop")}</span>
          <span className={styles.meta} style={{ fontSize: 13 }}>{t("formats")}</span>
          <input ref={input} type="file" className={styles.visuallyHidden} aria-label={t("file")} accept=".csv,.zip,.html,.htm" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {error && <span role="alert" className={styles.error}>{error}</span>}
        {job && (
          <div className={styles.progressBlock}>
            <div className={styles.progressHead}>
              <span>{fileName ?? t("job", { source: job.source })}</span>
              <span className={styles.meta}>
                {job.state === "failed" ? job.error : job.failed ? t("progressFailed", { done: job.done, failed: job.failed }) : t("progress", { done: job.done })}
              </span>
            </div>
            <div className={styles.bar}><div className={styles.barFill} style={{ width: `${job.state === "done" ? 100 : pct}%` }} /></div>
            <span className={styles.meta} style={{ fontSize: 13 }}>
              {job.state === "done" ? t("done") : t("running")}
            </span>
          </div>
        )}
      </section>
      <section className={styles.sectionPlain}>
        <h2 className={styles.h2}>{t("export.title")}</h2>
        <p className={styles.meta}>{t("export.lede")}</p>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            const res = await send("/api/v1/export", "POST");
            showToast({ message: res.ok ? t("export.started") : app("didNotGoThrough") });
          }}
        >
          {exporting ? t("export.busy") : t("export.action")}
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
  const t = useTranslations("app.settings.deleteAccount");
  const app = useTranslations("app.common");
  return (
    <section id="delete" className={styles.deleteSection}>
      <div className={styles.startText}>
        <h2 className={styles.h2}>{t("title")}</h2>
        <span className={styles.meta}>{t("lede")}</span>
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
            <span className={styles.label}>{t("type", { email })}</span>
            <input className={styles.profileInput} value={typed} autoFocus onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <button type="submit" className={styles.dangerButton} disabled={typed.trim().toLowerCase() !== email.toLowerCase()}>{t("now")}</button>
          <button type="button" className={styles.textButton} onClick={() => setOpen(false)}>{app("cancel")}</button>
          {error && <span role="alert" className={styles.error}>{error}</span>}
        </form>
      ) : (
        <button type="button" className={styles.dangerButton} onClick={() => setOpen(true)}>{t("action")}</button>
      )}
    </section>
  );
}
