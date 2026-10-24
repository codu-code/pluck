import { ObjectId } from "mongodb";
import { getClient, getDb } from "./client.ts";
import { db } from "./collections.ts";

// Test helpers. Each Vitest file runs against its own database (see vitest.setup.ts).

export async function createUser(email: string): Promise<string> {
  await db();
  const _id = new ObjectId();
  const now = new Date();
  await getDb().collection("users").insertOne({ _id, email, name: "", emailVerified: true, createdAt: now, updatedAt: now });
  return _id.toHexString();
}

// The two-user harness: every scoped query gets a test that writes as A and reads as B.
export async function twoUsers(): Promise<{ a: string; b: string }> {
  return { a: await createUser(`a-${Date.now()}@example.test`), b: await createUser(`b-${Date.now()}@example.test`) };
}

export async function dropTestDatabase(): Promise<void> {
  const db = getDb();
  if (!db.databaseName.startsWith("pluck_test_")) throw new Error(`refusing to drop ${db.databaseName}`);
  await db.dropDatabase();
  await getClient().close();
}

// Makes every queued job claimable now, so retry tests do not wait out their backoff.
export async function makeJobsVisible(): Promise<void> {
  await getDb().collection("jobs").updateMany({ state: "queued" }, { $set: { visibleAt: new Date(0) } });
}

// e2e: make one person's items look untouched for `days` (by email, so a browser test can call it).
export async function ageItemsOf(email: string, titles: string[], days: number): Promise<number> {
  const user = await getDb().collection("users").findOne({ email });
  if (!user) return 0;
  const res = await getDb()
    .collection("items")
    .updateMany({ userId: user._id, title: { $in: titles } }, { $set: { lastTouchedAt: new Date(Date.now() - days * 86_400_000) } });
  return res.modifiedCount;
}

// e2e: make one person's lists look idle for `days`.
export async function ageListsOf(email: string, days: number): Promise<number> {
  const user = await getDb().collection("users").findOne({ email });
  if (!user) return 0;
  return (await getDb().collection("lists").updateMany({ userId: user._id }, { $set: { lastActivityAt: new Date(Date.now() - days * 86_400_000) } })).modifiedCount;
}
