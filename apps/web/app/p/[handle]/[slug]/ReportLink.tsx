"use client";

import { REPORT_REASONS } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import styles from "./public.module.css";

// The Report link in the footer: a short form, sent to a person.
export function ReportLink({ listId }: { listId: string }) {
  const t = useTranslations("site.publicList.report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("spam");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  async function send(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/v1/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listId, reason, details: details || undefined }) });
    setState(res.ok ? "sent" : "error");
  }

  if (state === "sent") return <span role="status">{t("sent")}</span>;
  if (!open) return <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>{t("open")}</button>;
  return (
    <form className={styles.report} onSubmit={send}>
      <label className={styles.reportField}>
        <span>{t("reason")}</span>
        <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={styles.select}>
          {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}
        </select>
      </label>
      <label className={styles.reportField}>
        <span>{t("details")}</span>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className={styles.textarea} />
      </label>
      <div className={styles.reportActions}>
        <button type="submit" className={styles.pluckSmall}>{t("send")}</button>
        <button type="button" className={styles.linkButton} onClick={() => setOpen(false)}>{t("cancel")}</button>
      </div>
      {state === "error" && <span role="alert">{t("failed")}</span>}
    </form>
  );
}
