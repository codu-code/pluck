import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ItemList } from "@/components/ItemList";
import { requireUser } from "@/lib/auth";
import { browse, count, me, tagsOf } from "@/lib/library";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("inbox") };
}

export default async function Inbox({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireUser();
  const [page, total, { deleted }] = await Promise.all([
    browse(user.id, { status: "inbox", sort: "newest", limit: 50 }),
    count(user.id, "inbox"),
    searchParams,
  ]);
  const [tags, profile, expiringThisWeek] = await Promise.all([tagsOf(user.id), me(user.id), Promise.resolve(0)]);
  return (
    <ItemList view="inbox" initial={page} total={total} tags={tags} deletedId={deleted}
      expiry={{ days: profile.settings.expiryDays, scope: profile.settings.expiryScope }} expiringThisWeek={expiringThisWeek}
    />
  );
}
