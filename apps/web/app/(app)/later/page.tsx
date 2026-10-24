import type { Metadata } from "next";
import { ItemList } from "@/components/ItemList";
import { currentUser } from "@/lib/auth";
import { browse, count, tagsOf } from "@/lib/library";

export const metadata: Metadata = { title: "Later · Pluck" };

export default async function Later({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = (await currentUser())!;
  const [page, total, { deleted }] = await Promise.all([
    browse(user.id, { status: "later", sort: "newest", limit: 50 }),
    count(user.id, "later"),
    searchParams,
  ]);
  const tags = await tagsOf(user.id);
  return <ItemList view="later" initial={page} total={total} tags={tags} deletedId={deleted} />;
}
