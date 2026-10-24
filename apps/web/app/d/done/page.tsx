import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "../d.module.css";

export const metadata: Metadata = { title: "Pluck", robots: { index: false } };

export default async function Done({ searchParams }: { searchParams: Promise<{ a?: string; undo?: string; count?: string }> }) {
  const { a, undo, count } = await searchParams;
  const n = Number(count ?? 0);
  const message: Record<string, string> = {
    keep: "Kept. It stays where it is, and the days start again.",
    letgo: "Moved to the Archive. Nothing is deleted.",
    "undo-letgo": "Back where it was.",
    stop: "No more weekly emails. Turn them back on in Settings whenever you like.",
    "archive-all": `${n} item${n === 1 ? "" : "s"} moved to the Archive. Nothing is deleted.`,
  };
  return (
    <main className={styles.page}>
      <Logo size={32} />
      <h1 className={styles.title} role="status">{message[a ?? ""] ?? "Done."}</h1>
      {undo && (
        <form method="post" action={`/api/d/${undo}`}>
          <button type="submit" className={styles.secondary}>Undo</button>
        </form>
      )}
      <Link href="/inbox" className={styles.meta}>Open Pluck</Link>
    </main>
  );
}
