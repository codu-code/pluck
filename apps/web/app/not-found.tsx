import { Icon } from "@pluck/ui";
import Link from "next/link";

// A plain 404 with the Pluck mark (public pages that are private, gone or never were).
export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", alignContent: "center", gap: 16, padding: 16, textAlign: "center" }}>
      <Icon size={56} tone="bare" />
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Nothing here.</h1>
      <p style={{ margin: 0, color: "var(--ink2)" }}>It may be private now, or it never was.</p>
      <Link href="/">Go to Pluck</Link>
    </main>
  );
}
