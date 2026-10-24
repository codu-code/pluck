import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignInForm } from "./SignInForm";
import styles from "./signin.module.css";

export const metadata: Metadata = { title: "Sign in · Pluck" };

export default async function SignIn() {
  if (await currentUser()) redirect("/inbox");
  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <Logo size={48} />
        <div className={styles.copy}>
          <h1 className={styles.title}>Sign in to Pluck</h1>
          <p className={styles.lede}>We email you a link. No password, no profile form.</p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
