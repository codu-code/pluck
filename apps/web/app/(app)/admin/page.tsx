import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertAdmin, reportsToReview } from "@/lib/library";
import { AdminView } from "./AdminView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("admin"), robots: { index: false } };
}

// Behind the ADMIN_EMAILS allowlist; everyone else gets a 404, not a hint.
export default async function Admin() {
  const user = await requireUser();
  try {
    await assertAdmin(user.email);
  } catch {
    notFound();
  }
  return <AdminView initial={await reportsToReview()} />;
}
