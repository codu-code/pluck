import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignInForm } from "./SignInForm";
import styles from "./signin.module.css";

export const metadata: Metadata = { title: "Sign in · Pluck" };

// Only same-site paths, so a crafted link cannot bounce people elsewhere after sign-in.
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/inbox");

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <Logo size={48} />
        <div className={styles.copy}>
          <h1 className={styles.title}>Sign in to Pluck</h1>
          <p className={styles.lede}>We email you a link. No password, no profile form.</p>
        </div>
        <SignInForm next={next} />
      </div>
    </main>
  );
}
