import { NextIntlClientProvider } from "next-intl";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AnalyticsUser } from "@/components/AnalyticsUser";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@/lib/auth";
import { count, listsOf, me } from "@/lib/library";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const [inbox, later, lists, profile] = await Promise.all([count(user.id, "inbox"), count(user.id, "later"), listsOf(user.id), me(user.id)]);
  return (
    // The whole catalog for the app's client components (the root layout sends only the site's).
    <NextIntlClientProvider>
      <AppShell user={user} counts={{ inbox, later, lists: lists.length }} timezone={profile.settings.timezone}>
        <AnalyticsUser id={user.id} />
        {children}
      </AppShell>
    </NextIntlClientProvider>
  );
}
