"use client";

import type { Settings } from "@pluck/shared-schemas";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import styles from "./settings.module.css";

const send = (url: string, method: string, body: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Expiry and archive (Settings board). Expiry copy always says "to the Archive" and "nothing is deleted".
export function ExpirySection({ initial, staleCount: initialCount }: { initial: Settings; staleCount: number }) {
  const [settings, setSettings] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [confirming, setConfirming] = useState(false);
  const [toast, showToast] = useToast();
  const days = settings.expiryDays ?? 30;
  const scopeWords = settings.expiryScope === "inbox" ? "the Inbox" : "Inbox and Later";

  async function save(patch: Partial<Settings>) {
    const res = await send("/api/v1/me", "PATCH", { settings: patch });
    if (!res.ok) return showToast({ message: "That did not go through." });
    const next = { ...settings, ...patch };
    setSettings(next);
    const dry = await send("/api/v1/items/archive-stale", "POST", { dryRun: true });
    if (dry.ok) setCount(((await dry.json()) as { count: number }).count);
    if ("digestDay" in patch) return showToast({ message: next.digestDay === null ? "No weekly email." : "Weekly email day saved." });
    showToast({ message: next.expiryDays ? `Untouched for ${next.expiryDays} days goes to the Archive. Nothing is deleted.` : "Nothing expires now." });
  }

  async function sendNow() {
    const res = await send("/api/v1/digest/send", "POST", {});
    showToast({ message: res.ok ? "Sent. Check your email." : "That did not go through." });
  }

  async function archiveAll() {
    const res = await send("/api/v1/items/archive-stale", "POST", { dryRun: false });
    setConfirming(false);
    if (!res.ok) return showToast({ message: "That did not go through." });
    const { count: moved } = (await res.json()) as { count: number };
    setCount(0);
    showToast({ message: `${moved} item${moved === 1 ? "" : "s"} moved to the Archive. Nothing is deleted.` });
  }

  return (
    <section id="expiry" className={styles.section}>
      <h2 className={styles.h2}>Expiry and archive</h2>
      <p className={styles.meta} style={{ maxWidth: 620 }}>
        Things you don&apos;t touch move to the Archive on their own. They are never deleted. Search still finds them, and Restore puts them
        back. Items in a list never expire.
      </p>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Move to Archive after</span>
          <select
            className={styles.selectField}
            value={settings.expiryDays ?? "never"}
            onChange={(e) => save({ expiryDays: e.target.value === "never" ? null : (Number(e.target.value) as 14 | 30 | 60 | 90) })}
          >
            {[14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days untouched</option>)}
            <option value="never">Never</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Applies to</span>
          <select className={styles.selectField} value={settings.expiryScope} onChange={(e) => save({ expiryScope: e.target.value as Settings["expiryScope"] })}>
            <option value="inbox_later">Inbox and Later</option>
            <option value="inbox">Inbox only</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Weekly email</span>
          <select
            className={styles.selectField}
            value={settings.digestDay ?? "off"}
            onChange={(e) => save({ digestDay: e.target.value === "off" ? null : Number(e.target.value) })}
          >
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
              <option key={d} value={i}>{d} at 06:00</option>
            ))}
            <option value="off">Off</option>
          </select>
        </label>
        <span className={styles.profileHint}>
          The weekly email warns you a week before.{" "}
          <button type="button" className={styles.linkButton} onClick={sendNow}>Send me one now</button>
        </span>
      </div>
      <div className={styles.startClean}>
        <div className={styles.startText}>
          <b>Start clean</b>
          <span className={styles.meta}>
            Move everything in {scopeWords} older than {days} days to the Archive, right now. {count} item{count === 1 ? "" : "s"}. Lists are left alone.
          </span>
        </div>
        {confirming ? (
          <span className={styles.confirm} style={{ color: "var(--ink)" }}>
            Move {count} to the Archive? Nothing is deleted.
            <button type="button" className={styles.inkButton} onClick={archiveAll}>Yes, archive them</button>
            <button type="button" className={styles.textButton} onClick={() => setConfirming(false)}>Cancel</button>
          </span>
        ) : (
          <button type="button" className={styles.inkButton} disabled={count === 0} onClick={() => setConfirming(true)}>
            Archive it all. No, really.
          </button>
        )}
      </div>
      {toast}
    </section>
  );
}
