import { Logo } from "@pluck/ui";
import Link from "next/link";

// Placeholder home until the marketing site lands in slice 15.
export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", alignContent: "center", gap: 24 }}>
      <Logo size={96} />
      <p style={{ margin: 0, color: "var(--ink2)", fontSize: 18 }}>Pluck it.</p>
      <Link href="/signin">Sign in</Link>
    </main>
  );
}
