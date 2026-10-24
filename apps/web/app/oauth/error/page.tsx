import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import styles from "../consent/consent.module.css";

export const metadata: Metadata = { title: "That did not work · Pluck", robots: { index: false } };

// Where Better Auth sends a failed authorisation request (an unknown client, a wrong redirect, an expired link).
export default async function OAuthError({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string }> }) {
  const { error, error_description } = await searchParams;
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Logo size={48} />
        <h1 className={styles.title}>That connection did not work.</h1>
        <p className={styles.meta}>Start it again from your AI tool. If it keeps happening, remove Pluck there and add it again.</p>
        {error && <p className={styles.meta} style={{ fontSize: 13 }}>{error_description || error}</p>}
      </div>
    </main>
  );
}
