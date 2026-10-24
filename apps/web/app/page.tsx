import { Logo } from "@pluck/ui";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", alignContent: "center", gap: 24 }}>
      <Logo size={96} />
      <p style={{ margin: 0, color: "var(--ink2)", fontSize: 18 }}>Pluck it.</p>
    </main>
  );
}
