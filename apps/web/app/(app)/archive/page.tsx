import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { browse, me } from "@/lib/library";
import { ArchiveView } from "./ArchiveView";

export const metadata: Metadata = { title: "Archive · Pluck" };

export default async function Archive({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = (await currentUser())!;
  const bin = (await searchParams).view === "bin";
  const [page, profile] = await Promise.all([browse(user.id, { status: bin ? "bin" : "archive", archive: "all", sort: "newest", limit: 50 }), me(user.id)]);
  return <ArchiveView key={bin ? "bin" : "archive"} initial={page} bin={bin} expiryDays={profile.settings.expiryDays} />;
}
