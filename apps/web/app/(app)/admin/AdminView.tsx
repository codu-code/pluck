"use client";

import type { AdminReport } from "@pluck/shared-schemas";
import { useState } from "react";
import styles from "../settings/settings.module.css";

export function AdminView({ initial }: { initial: AdminReport[] }) {
  const [reports, setReports] = useState(initial);
  const act = async (url: string, after: (r: AdminReport) => AdminReport | null, id: string) => {
    if ((await fetch(url, { method: "POST" })).ok) setReports((cur) => cur.flatMap((r) => (r.id === id ? (after(r) ? [after(r)!] : []) : [r])));
  };
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Reports</h1>
        <span className={styles.meta}>{reports.length} open</span>
      </div>
      {reports.length === 0 ? (
        <p className={styles.meta}>Nothing to review.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th scope="col">List</th><th scope="col">Reason</th><th scope="col">Owner</th><th scope="col"><span className={styles.visuallyHidden}>Actions</span></th></tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.list && r.owner?.handle ? <a href={`/@${r.owner.handle}/${r.list.slug}`} target="_blank" rel="noreferrer">{r.list.name}</a> : (r.list?.name ?? "gone")}
                    {r.list?.killed && <span className={styles.byAi}> taken down</span>}
                  </td>
                  <td>{r.reason}{r.details && <div className={styles.meta}>{r.details}</div>}</td>
                  <td>{r.owner ? `${r.owner.handle ? `@${r.owner.handle}` : ""} ${r.owner.email}` : "?"}{r.owner?.closed && <span className={styles.byAi}> closed</span>}</td>
                  <td className={styles.actions}>
                    {r.list && !r.list.killed && (
                      <button type="button" className={styles.textButton} onClick={() => act(`/api/v1/admin/lists/${r.list!.id}`, (x) => ({ ...x, list: { ...x.list!, killed: true } }), r.id)}>Take down list</button>
                    )}
                    {r.owner && !r.owner.closed && (
                      <button type="button" className={styles.textButton} onClick={() => act(`/api/v1/admin/users/${r.owner!.id}`, (x) => ({ ...x, owner: { ...x.owner!, closed: true } }), r.id)}>Close their public pages</button>
                    )}
                    <button type="button" className={styles.textButton} onClick={() => act(`/api/v1/admin/reports/${r.id}`, () => null, r.id)}>Resolve</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
