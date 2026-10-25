import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { listsOf, sharedWithMe } from "@/lib/library";
import { ListsView } from "./ListsView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("lists") };
}

export default async function Lists() {
  const user = await requireUser();
  const [mine, shared] = await Promise.all([listsOf(user.id), sharedWithMe(user.id)]);
  return <ListsView initial={mine} shared={shared} />;
}
