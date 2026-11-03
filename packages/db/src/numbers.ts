import { db, items, lists, users } from "./collections.ts";

const DAY = 86_400_000;

// How Pluck is doing across every account, for the people who run it (pnpm numbers). Counts only: no ids, no email,
// nothing anyone plucked. PostHog sees only people who said yes; this sees everyone.
export async function numbers(now = new Date()) {
  const week = new Date(now.getTime() - 7 * DAY);
  const [u, i, l, d] = [await users(), await items(), await lists(), await db()];
  const group = <T,>(rows: { _id: T; n: number }[]) => Object.fromEntries(rows.map((r) => [String(r._id ?? "unknown"), r.n]));
  const [accounts, signUpsThisWeek, via, consent, bySource, sourcesThisWeek, surfaces, publicLists, mcpThisWeek, aiTools] = await Promise.all([
    u.countDocuments({}),
    u.countDocuments({ createdAt: { $gte: week } }),
    u.aggregate<{ _id: string; n: number }>([{ $match: { createdAt: { $gte: week } } }, { $group: { _id: "$via", n: { $sum: 1 } } }]).toArray(),
    u.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$settings.analytics", n: { $sum: 1 } } }]).toArray(),
    i.aggregate<{ _id: string; n: number }>([{ $match: { deletedAt: null } }, { $group: { _id: "$source", n: { $sum: 1 } } }]).toArray(),
    i.aggregate<{ _id: string; n: number }>([{ $match: { createdAt: { $gte: week } } }, { $group: { _id: "$source", n: { $sum: 1 } } }]).toArray(),
    // How many accounts have plucked from 1, 2, 3… surfaces (imports and copied Lists are not a surface).
    i.aggregate<{ _id: number; n: number }>([
      { $match: { source: { $in: ["web", "extension", "ios", "email", "mcp", "api"] } } },
      { $group: { _id: "$userId", s: { $addToSet: "$source" } } },
      { $group: { _id: { $size: "$s" }, n: { $sum: 1 } } },
    ]).toArray(),
    l.countDocuments({ visibility: "public" }),
    u.countDocuments({ lastMcpCallAt: { $gte: week } }),
    d.collection("oauthConsent").aggregate<{ _id: string; n: number }>([
      { $lookup: { from: "oauthClient", localField: "clientId", foreignField: "clientId", as: "c" } },
      { $group: { _id: { $ifNull: [{ $first: "$c.name" }, "$clientId"] }, n: { $sum: 1 } } },
    ]).toArray(),
  ]);
  return {
    accounts, signUpsThisWeek, viaThisWeek: group(via), analyticsAnswer: group(consent),
    itemsBySource: group(bySource), itemsBySourceThisWeek: group(sourcesThisWeek), accountsBySurfaceCount: group(surfaces),
    publicLists, accountsUsingAnAiToolThisWeek: mcpThisWeek, connectionsByTool: group(aiTools),
  };
}
