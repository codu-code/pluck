import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { assertAdmin, reportsToReview } from "@/lib/library";
import { AdminView } from "./AdminView";

export const metadata: Metadata = { title: "Admin · Pluck", robots: { index: false } };

// Behind the ADMIN_EMAILS allowlist; everyone else gets a 404, not a hint.
export default async function Admin() {
  const user = (await currentUser())!;
  try {
    await assertAdmin(user.email);
  } catch {
    notFound();
  }
  return <AdminView initial={await reportsToReview()} />;
}
