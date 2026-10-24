import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import { runTap } from "@/lib/library";
import { verifyTap } from "@/lib/signed";
import { AutoSubmit } from "./AutoSubmit";
import styles from "../d.module.css";

export const metadata: Metadata = { title: "Pluck", robots: { index: false } };

const DOING = { keep: "Keeping it", letgo: "Moving it to the Archive", "undo-letgo": "Putting it back", stop: "Stopping the weekly email" } as const;

// The page a digest link opens. It acts with one tap through a form POST (submitted for you), so a mail
// scanner that only fetches links changes nothing. Archive it all waits for a real yes.
export default async function Tap({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ count?: string }> }) {
  const { token } = await params;
  const tap = verifyTap(token);
  // Counting is read-only, so Archive it all shows its number straight away.
  const count = (await searchParams).count ?? (tap?.a === "archive-all" ? String((await runTap(token)).count ?? 0) : undefined);
  return (
    <main className={styles.page}>
      <Logo size={32} />
      {!tap ? (
        <>
          <h1 className={styles.title}>This link has expired.</h1>
          <p className={styles.meta}>Links in the email work for 7 days. Everything is still in Pluck.</p>
        </>
      ) : tap.a === "archive-all" ? (
        <>
          <h1 className={styles.title}>Archive it all. No, really.</h1>
          {
            <>
              <p className={styles.meta}>
                {count} item{count === "1" ? "" : "s"} untouched for longer than your expiry length move to the Archive. Nothing is deleted, and lists are left alone.
              </p>
              <form method="post" action={`/api/d/${token}`}>
                <input type="hidden" name="confirm" value="1" />
                <button type="submit" className={styles.primary} disabled={count === "0"}>Yes, move {count} to the Archive</button>
              </form>
            </>
          }
        </>
      ) : (
        <>
          <h1 className={styles.title}>{DOING[tap.a]}</h1>
          <form method="post" action={`/api/d/${token}`} id="tap">
            <noscript>
              <button type="submit" className={styles.primary}>Confirm</button>
            </noscript>
          </form>
          <AutoSubmit formId="tap" />
        </>
      )}
    </main>
  );
}
