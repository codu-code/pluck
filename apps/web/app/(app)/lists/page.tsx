import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listsOf } from "@/lib/library";
import { ListsView } from "./ListsView";

export const metadata: Metadata = { title: "Lists · Pluck" };

export default async function Lists() {
  const user = await requireUser();
  return <ListsView initial={await listsOf(user.id)} />;
}
