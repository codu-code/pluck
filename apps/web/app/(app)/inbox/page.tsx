import type { Metadata } from "next";
import { ItemList } from "@/components/ItemList";
import { currentUser } from "@/lib/auth";
import { browse, count, tagsOf } from "@/lib/library";

export const metadata: Metadata = { title: "Inbox · Pluck" };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = (await currentUser())!; // the (app) layout already redirected signed-out visitors
  const [page, total, { deleted }] = await Promise.all([
    browse(user.id, { status: "inbox", sort: "newest", limit: 50 }),
    count(user.id, "inbox"),
    searchParams,
  ]);
  const tags = await tagsOf(user.id);
  return <ItemList view="inbox" initial={page} total={total} tags={tags} deletedId={deleted} />;
}
