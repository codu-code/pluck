import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import styles from "../../oauth/consent/consent.module.css";

export const metadata: Metadata = { title: "Connected · Pluck", robots: { index: false } };

// Where the extension's sign-in ends. The extension reads the code from this tab's address (it holds the
// PKCE verifier, so the code is useless to anyone else) and closes the tab.
export default function Connected() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Logo size={48} />
        <h1 className={styles.title}>You can pluck from your browser now.</h1>
        <p className={styles.meta}>Close this tab, or click the Pluck button on any page. Alt+Shift+P does it without the click.</p>
      </div>
    </main>
  );
}
