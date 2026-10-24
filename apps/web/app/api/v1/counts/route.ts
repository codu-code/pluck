import { json, route } from "@/lib/api";
import { count, listsOf } from "@/lib/library";

// The rail's numbers: Inbox, Later and Lists.
export const GET = route({ kind: "read" }, async ({ caller }) => {
  const [inbox, later, lists] = await Promise.all([count(caller.userId, "inbox"), count(caller.userId, "later"), listsOf(caller.userId)]);
  return json({ inbox, later, lists: lists.length });
});
