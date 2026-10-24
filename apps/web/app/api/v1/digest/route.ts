import { json, route } from "@/lib/api";
import { digest } from "@/lib/library";

// Rule-based resurfacing: expiring within 7 days (not in a list), due this week, oldest inbox, quiet lists.
export const GET = route({ kind: "read" }, async ({ req, caller }) => {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 5) || 5, 25);
  return json(await digest(caller.userId, { limit }));
});
