"use client";

import type { Settings } from "@pluck/shared-schemas";
import { useFormatter, useTranslations } from "next-intl";
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
  const t = useTranslations("app.settings.expiry");
  const app = useTranslations("app.common");
  const format = useFormatter();
  // Sunday is 0, as digestDay counts. 4 Jan 1970 was a Sunday.
  const dayName = (i: number) => format.dateTime(new Date(Date.UTC(1970, 0, 4 + i)), { weekday: "long", timeZone: "UTC" });

  async function save(patch: Partial<Settings>) {
    const res = await send("/api/v1/me", "PATCH", { settings: patch });
    if (!res.ok) return showToast({ message: app("didNotGoThrough") });
    const next = { ...settings, ...patch };
    setSettings(next);
    const dry = await send("/api/v1/items/archive-stale", "POST", { dryRun: true });
    if (dry.ok) setCount(((await dry.json()) as { count: number }).count);
    if ("digestDay" in patch) return showToast({ message: next.digestDay === null ? t("digestOff") : t("digestSaved") });
    showToast({ message: next.expiryDays ? t("saved", { days: next.expiryDays }) : t("never") });
  }

  async function sendNow() {
    const res = await send("/api/v1/digest/send", "POST", {});
    showToast({ message: res.ok ? t("sent") : app("didNotGoThrough") });
  }

  async function archiveAll() {
    const res = await send("/api/v1/items/archive-stale", "POST", { dryRun: false });
    setConfirming(false);
    if (!res.ok) return showToast({ message: app("didNotGoThrough") });
    const { count: moved } = (await res.json()) as { count: number };
    setCount(0);
    showToast({ message: t("archived", { count: moved }) });
  }

  return (
    <section id="expiry" className={styles.section}>
      <h2 className={styles.h2}>{t("title")}</h2>
      <p className={styles.meta} style={{ maxWidth: 620 }}>
        {t("lede")}
      </p>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>{t("after")}</span>
          <select
            className={styles.selectField}
            value={settings.expiryDays ?? "never"}
            onChange={(e) => save({ expiryDays: e.target.value === "never" ? null : (Number(e.target.value) as 14 | 30 | 60 | 90) })}
          >
            {[14, 30, 60, 90].map((d) => <option key={d} value={d}>{t("days", { days: d })}</option>)}
            <option value="never">{t("neverOption")}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("scope")}</span>
          <select className={styles.selectField} value={settings.expiryScope} onChange={(e) => save({ expiryScope: e.target.value as Settings["expiryScope"] })}>
            <option value="inbox_later">{t("scopeInboxLater")}</option>
            <option value="inbox">{t("scopeInbox")}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("digest")}</span>
          <select
            className={styles.selectField}
            value={settings.digestDay ?? "off"}
            onChange={(e) => save({ digestDay: e.target.value === "off" ? null : Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <option key={i} value={i}>{t("digestDay", { day: dayName(i) })}</option>
            ))}
            <option value="off">{t("digestOffOption")}</option>
          </select>
        </label>
        <span className={styles.profileHint}>
          {t("warns")}{" "}
          <button type="button" className={styles.linkButton} onClick={sendNow}>{t("sendNow")}</button>
        </span>
      </div>
      <div className={styles.startClean}>
        <div className={styles.startText}>
          <b>{t("clean.title")}</b>
          <span className={styles.meta}>
            {t("clean.body", { scope: settings.expiryScope, days, count })}
          </span>
        </div>
        {confirming ? (
          <span className={styles.confirm} style={{ color: "var(--ink)" }}>
            {t("clean.confirm", { count })}
            <button type="button" className={styles.inkButton} onClick={archiveAll}>{t("clean.yes")}</button>
            <button type="button" className={styles.textButton} onClick={() => setConfirming(false)}>{app("cancel")}</button>
          </span>
        ) : (
          <button type="button" className={styles.inkButton} disabled={count === 0} onClick={() => setConfirming(true)}>
            {t("clean.action")}
          </button>
        )}
      </div>
      {toast}
    </section>
  );
}
