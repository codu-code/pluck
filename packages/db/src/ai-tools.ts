import type { AiConnection } from "@pluck/shared-schemas";
import { db, oid } from "./collections.ts";

// The AI tools a person has connected over OAuth. Better Auth's OAuth provider owns these rows;
// Pluck reads them for Settings and removes them to disconnect. Its Mongo adapter stores userId as an ObjectId.
type ConsentDoc = { clientId: string; userId: unknown; scopes: string[]; createdAt: Date };
type ClientDoc = { clientId: string; name?: string | null };

const byUser = (userId: string) => ({ userId: { $in: [oid(userId), userId] } });

export async function aiConnections(userId: string): Promise<AiConnection[]> {
  const d = await db();
  const consents = await d.collection<ConsentDoc>("oauthConsent").find(byUser(userId)).sort({ createdAt: -1 }).toArray();
  const clients = await d.collection<ClientDoc>("oauthClient").find({ clientId: { $in: consents.map((c) => c.clientId) } }).toArray();
  const names = new Map(clients.map((c) => [c.clientId, c.name]));
  return consents.map((c) => ({
    clientId: c.clientId,
    name: names.get(c.clientId) || (c.clientId.startsWith("https://") ? new URL(c.clientId).host : "An AI tool"),
    scopes: c.scopes.filter((s) => s.startsWith("library:")),
    connectedAt: c.createdAt.toISOString(),
  }));
}

// Checked on every connector call, so Disconnect takes effect at once rather than when the access token runs out.
export async function isAiConnected(userId: string, clientId: string): Promise<boolean> {
  return (await (await db()).collection("oauthConsent").countDocuments({ ...byUser(userId), clientId }, { limit: 1 })) > 0;
}

export async function disconnectAi(userId: string, clientId: string): Promise<boolean> {
  const d = await db();
  const { deletedCount } = await d.collection("oauthConsent").deleteMany({ ...byUser(userId), clientId });
  await d.collection("oauthRefreshToken").deleteMany({ ...byUser(userId), clientId });
  return deletedCount > 0;
}
