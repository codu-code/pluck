import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { browse } from "@/lib/library";
import { InboxView } from "./InboxView";

export const metadata: Metadata = { title: "Inbox · Pluck" };

export default async function Inbox() {
  const user = (await currentUser())!; // the (app) layout already redirected signed-out visitors
  const page = await browse(user.id, { status: "inbox", sort: "newest", limit: 50 });
  return <InboxView initial={page} />;
}
