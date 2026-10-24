import { Logo } from "@pluck/ui";
import Link from "next/link";

export const dynamic = "force-static";

export default function Offline() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", alignContent: "center", gap: 16, padding: 16, textAlign: "center" }}>
      <Logo size={40} />
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>You are offline.</h1>
      <p style={{ margin: 0, color: "var(--ink2)", maxWidth: 420 }}>
        Pages you opened recently are still here. Plucks you make now will sync when you are back.
      </p>
      <Link href="/inbox">Try the Inbox</Link>
    </main>
  );
}
