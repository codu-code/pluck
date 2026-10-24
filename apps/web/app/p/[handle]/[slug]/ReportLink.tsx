"use client";

import { REPORT_REASONS } from "@pluck/shared-schemas";
import { useState, type FormEvent } from "react";
import styles from "./public.module.css";

const LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  illegal: "Illegal content", minors: "Sexualises minors", harassment: "Harassment", doxxing: "Shares someone's private details",
  spam: "Spam or a link farm", malware: "Malware or phishing", infringement: "Copyright or trademark", other: "Something else",
};

// The Report link in the footer: a short form, sent to a person.
export function ReportLink({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("spam");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  async function send(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/v1/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listId, reason, details: details || undefined }) });
    setState(res.ok ? "sent" : "error");
  }

  if (state === "sent") return <span role="status">Thanks. A person reads every report.</span>;
  if (!open) return <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>Report this list</button>;
  return (
    <form className={styles.report} onSubmit={send}>
      <label className={styles.reportField}>
        <span>What is wrong?</span>
        <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={styles.select}>
          {REPORT_REASONS.map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
        </select>
      </label>
      <label className={styles.reportField}>
        <span>Anything we should know (optional)</span>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className={styles.textarea} />
      </label>
      <div className={styles.reportActions}>
        <button type="submit" className={styles.pluckSmall}>Send the report</button>
        <button type="button" className={styles.linkButton} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {state === "error" && <span role="alert">That did not go through. Try again in a minute.</span>}
    </form>
  );
}
