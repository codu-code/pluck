"use client";

import { answer, createQueue, type Queued } from "@pluck/client";
import { extractUrls, isFileType, MAX_FILE_BYTES, type CreateItemBody, type Item, type PluckResponse, type TextKind } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./TopBar.module.css";

// `file`: a picture or a PDF on its way up, shown as that Kind while it goes.
export type PluckDraft = { key: string; urls: string[]; text: string | null; kind: TextKind | null; file?: "image" | "pdf" };

type Props = {
  sample?: string;
  // The empty inbox's look: 1.5px ink border and a "Pluck it" button, pointing at step 1.
  emphasis?: boolean;
  onPluck?: (draft: PluckDraft) => void;
  onPlucked?: (key: string, result: PluckResponse) => void;
  onFailed?: (draft: PluckDraft) => void;
};

const KINDS: TextKind[] = ["note", "todo", "thing"];

const QUEUE_KEY = "pluck:queue";

// Plucks made offline wait in this browser and go when the network is back. A page that closes mid-send leaves its
// pluck queued though it may have landed; the queue sends each with a clientKey, so a resend never makes a second Note.
const queue = createQueue({
  read: async () => {
    try {
      // Entries queued before the shared queue were { draft, body }: the draft's key is their id.
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as (Queued & { draft?: { key: string } })[];
      return q.map((x) => (x.id || !x.draft ? x : { id: x.draft.key, body: x.body, at: 0 }));
    } catch {
      return [];
    }
  },
  write: async (q) => {
    try {
      if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
      else localStorage.removeItem(QUEUE_KEY);
    } catch {
      // storage blocked: the pluck stays on screen as a draft row until reload
    }
  },
});

const post = (body: CreateItemBody) =>
  fetch("/api/v1/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// The paste box (Flow 3): one link, a block of links, or a sentence that becomes a Note, Todo or Thing. No modal.
export function TopBar({ sample, emphasis = false, onPluck, onPlucked, onFailed }: Props) {
  const [value, setValue] = useState(sample ?? "");
  const [kind, setKind] = useState<TextKind>("note");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const t = useTranslations("app.topBar");
  const kindName = useTranslations("app.kind");

  // Send anything queued while offline, now and whenever the network comes back.
  useEffect(() => {
    // One drain at a time across every open tab: mount, the online event and a re-render can all start one.
    // A Web Lock where the browser has one, else the queue's own guard, one per page.
    function flush() {
      if (!navigator.onLine) return;
      const drain = () =>
        queue.drain(async (body, q) => {
          const result = await answer<PluckResponse | null>(await post(body)); // a gateway error page is not JSON
          if (result && q.id) onPlucked?.(q.id, result);
        });
      void (navigator.locks ? navigator.locks.request(QUEUE_KEY, { ifAvailable: true }, (lock) => lock && drain()) : drain());
    }
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [onPlucked]);

  // A picture or a PDF, pasted into the box or dropped anywhere on the page: the Item at once, the bytes straight to
  // the bucket, then "it is in", so the picture shows without waiting for the worker. Anything else is said no to.
  async function pluckFiles(files: File[]) {
    setError(null);
    setNotice(null);
    const taken = files.filter((f) => isFileType(f.type) && f.size > 0 && f.size <= MAX_FILE_BYTES);
    if (taken.length < files.length) setError(t("fileRefused"));
    for (const file of taken) {
      const draft: PluckDraft = { key: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, urls: [], text: file.name, kind: null, file: file.type === "application/pdf" ? "pdf" : "image" };
      const about = { name: file.name, contentType: file.type };
      const send = (path: string, body: object) => fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const landed = (item: Item) => onPlucked?.(draft.key, { results: [{ item, created: true }], rejected: [] });
      onPluck?.(draft);
      try {
        const begun = await send("/api/v1/items/files", { ...about, size: file.size, source: "web" });
        if (!begun.ok) throw new Error("refused");
        const { item, uploadUrl } = (await begun.json()) as { item: Item; uploadUrl: string };
        landed(item);
        window.dispatchEvent(new Event("pluck:counts"));
        if (!(await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file })).ok) throw new Error("upload");
        const kept = await send(`/api/v1/items/${item.id}/file`, about);
        if (kept.ok) landed(((await kept.json()) as { item: Item }).item); // else the worker reads it on its next pass
      } catch {
        setError(t("failed"));
        onFailed?.(draft);
      }
    }
  }
  const latest = useRef(pluckFiles);
  latest.current = pluckFiles;

  // Files dragged over the page are for the box, wherever they are let go.
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    const files = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes("Files"));
    const over = (e: DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      setDropping(true);
    };
    const out = (e: DragEvent) => { if (!e.relatedTarget) setDropping(false); }; // left the window
    const drop = (e: DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      setDropping(false);
      void latest.current([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", out);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", out);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const text = value.trim();
  const urls = text ? extractUrls(text) : [];
  const isText = Boolean(text) && urls.length === 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text) return;
    setError(null);
    setNotice(null);
    const draft: PluckDraft = { key: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, urls, text: isText ? text : null, kind: isText ? kind : null };
    const body: CreateItemBody = isText
      ? { text, kind, source: "web", ...(due && kind !== "note" ? { dueAt: new Date(`${due}T09:00:00`).toISOString() } : {}) }
      : { text, source: "web" };
    setValue("");
    setDue("");
    onPluck?.(draft);
    let res: Response;
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      res = await post({ ...body, clientKey: draft.key }); // the key the queued copy goes with, so a lost answer makes no second Note
    } catch {
      await queue.add(body, draft.key); // the draft's row and the queued pluck share a key
      setNotice(t("queued"));
      return;
    }
    const json = await res.json().catch(() => null); // a gateway error page is not JSON
    if (res.ok) {
      window.dispatchEvent(new Event("pluck:counts"));
      if (!json) return;
      const result = json as PluckResponse;
      if (result.rejected.length) setError(t("rejected", { count: result.rejected.length, reason: result.rejected[0]!.message }));
      return onPlucked?.(draft.key, result);
    }
    setError(json?.rejected?.[0]?.message ?? json?.error?.message ?? t("failed"));
    setValue(text);
    onFailed?.(draft);
    input.current?.focus();
  }

  return (
    <form className={styles.bar} onSubmit={submit}>
      <div className={emphasis ? `${styles.pluck} ${styles.emphasis}` : styles.pluck} data-dropping={dropping || undefined}>
        <label className={styles.pluckLabel} htmlFor="pluck-box">
          {t("label")}
        </label>
        <input
          ref={input}
          id="pluck-box"
          className={styles.input}
          type="text"
          name="pluck"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e) => {
            // A copied picture or file (a screenshot, a file from Finder) plucks as it is; text pastes as text.
            const files = [...e.clipboardData.files];
            if (!files.length) return;
            e.preventDefault();
            void pluckFiles(files);
          }}
          placeholder={dropping ? t("drop") : t("placeholder")}
          aria-describedby="pluck-hint"
          autoComplete="off"
        />
        {emphasis ? (
          <button type="submit" className={styles.button}>
            {t("submit")}
          </button>
        ) : (
          <kbd className={styles.kbd}>c</kbd>
        )}
      </div>
      <Link href="/search" className={styles.search}>
        {t("search")}<kbd className={styles.kbd}>/</kbd>
      </Link>
      <div id="pluck-hint" className={styles.hint} aria-live="polite">
        {notice && !text && <span>{notice}</span>}
        {urls.length > 1 && <span>{t("links", { count: urls.length })}</span>}
        {isText && (
          <span className={styles.textKinds}>
            <span role="radiogroup" aria-label={t("as")} className={styles.segments}>
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  className={styles.segment}
                  onClick={() => setKind(k)}
                >
                  {kindName(k)}
                </button>
              ))}
            </span>
            {kind !== "note" && (
              <label className={styles.due}>
                {t("due")}
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={styles.dateInput} />
              </label>
            )}
            <span>{t("enterAs", { kind })}</span>
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
