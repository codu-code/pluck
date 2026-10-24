import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { listsOf } from "@/lib/library";
import { ListsView } from "./ListsView";

export const metadata: Metadata = { title: "Lists · Pluck" };

export default async function Lists() {
  const user = (await currentUser())!;
  return <ListsView initial={await listsOf(user.id)} />;
}
