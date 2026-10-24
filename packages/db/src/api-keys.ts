import { createHash, randomBytes } from "node:crypto";
import type { ApiKey } from "@pluck/shared-schemas";
import { ObjectId } from "mongodb";
import { apiKeys, oid, type ApiKeyDoc } from "./collections.ts";

// Personal API keys: pk_live_<32 hex>. Only a SHA-256 hash and a 6-character prefix are stored.
// They never expire, revoke in one click, and show when they were last used.

const hash = (key: string) => createHash("sha256").update(key).digest("hex");
export const DEFAULT_KEY_SCOPES = ["library:read", "library:write"];

const toKey = (d: ApiKeyDoc): ApiKey => ({
  id: d._id.toHexString(), name: d.name, prefix: d.prefix, scopes: d.scopes, lastUsedAt: d.lastUsedAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString(),
});

export async function createApiKey(userId: string, name: string, scopes = DEFAULT_KEY_SCOPES): Promise<{ key: string; apiKey: ApiKey }> {
  const secret = randomBytes(16).toString("hex");
  const key = `pk_live_${secret}`;
  const doc: ApiKeyDoc = {
    _id: new ObjectId(), userId: oid(userId), name: name.trim().slice(0, 60) || "Key", hash: hash(key), prefix: secret.slice(0, 6), scopes,
    lastUsedAt: null, createdAt: new Date(),
  };
  await (await apiKeys()).insertOne(doc);
  return { key, apiKey: toKey(doc) };
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  return (await (await apiKeys()).find({ userId: oid(userId) }).sort({ createdAt: -1 }).toArray()).map(toKey);
}

export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  return (await (await apiKeys()).deleteOne({ _id: oid(id), userId: oid(userId) })).deletedCount === 1;
}

// The bearer check. lastUsedAt is written at most once a minute so busy scripts do not write on every call.
export async function verifyApiKey(key: string, now = new Date()): Promise<{ userId: string; scopes: string[] } | null> {
  if (!key.startsWith("pk_live_")) return null;
  const col = await apiKeys();
  const doc = await col.findOne({ hash: hash(key) });
  if (!doc) return null;
  if (!doc.lastUsedAt || now.getTime() - doc.lastUsedAt.getTime() > 60_000) await col.updateOne({ _id: doc._id }, { $set: { lastUsedAt: now } });
  return { userId: doc.userId.toHexString(), scopes: doc.scopes };
}
