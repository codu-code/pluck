import { Logo } from "@pluck/ui";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { publicListFor } from "@/lib/library";
import { CopyButton } from "./CopyButton";

export const metadata: Metadata = { title: "Pluck this list · Pluck" };

// "Pluck this list" lands here: sign in first if needed, then one button. No surprise writes on a GET.
export default async function CopyPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/copy/${listId}`)}`);
  const page = await publicListFor(listId);
  if (!page) notFound();
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", alignContent: "center", gap: 20, padding: 16, textAlign: "center" }}>
      <Logo size={36} />
      <h1 style={{ margin: 0, fontSize: 28, lineHeight: "34px", fontWeight: 600 }}>Pluck “{page.list.name}” into your library?</h1>
      <p style={{ margin: 0, color: "var(--ink2)", maxWidth: 440 }}>
        {page.entries.length} item{page.entries.length === 1 ? "" : "s"} land in your Inbox, and a private copy of the list keeps their order and notes.
      </p>
      <CopyButton listId={listId} />
    </main>
  );
}
