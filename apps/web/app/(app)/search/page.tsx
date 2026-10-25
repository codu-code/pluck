import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { listsOf, search, tagsOf } from "@/lib/library";
import { SearchView } from "./SearchView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("search") };
}

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = (await searchParams).q?.trim() ?? "";
  const [initial, tags, lists] = await Promise.all([q ? search(user.id, { q, limit: 25 }) : null, tagsOf(user.id), listsOf(user.id)]);
  return <SearchView initialQuery={q} initial={initial} tags={tags} lists={lists} />;
}
