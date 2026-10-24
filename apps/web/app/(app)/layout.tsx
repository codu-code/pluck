import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/lib/auth";
import { count, listsOf } from "@/lib/library";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const [inbox, later, lists] = await Promise.all([count(user.id, "inbox"), count(user.id, "later"), listsOf(user.id)]);
  return <AppShell user={user} counts={{ inbox, later, lists: lists.length }}>{children}</AppShell>;
}
