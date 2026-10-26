import { expect, test } from "vitest";
import { aiConnections, disconnectAi, isAiConnected, narrowAiGrants } from "./ai-tools.ts";
import { db, oid } from "./collections.ts";
import { twoUsers } from "./testing.ts";

// Rows shaped the way Better Auth's OAuth provider writes them.
async function connect(userId: string, clientId: string, name: string) {
  const d = await db();
  await d.collection("oauthClient").updateOne({ clientId }, { $set: { clientId, name } }, { upsert: true });
  await d.collection("oauthConsent").insertOne({ clientId, userId: oid(userId), scopes: ["offline_access", "library:read", "library:write"], createdAt: new Date() });
  await d.collection("oauthRefreshToken").insertOne({ clientId, userId: oid(userId), token: "t", scopes: [] });
}

test("connections are per person, and disconnecting removes the consent and the refresh tokens", async () => {
  const { a, b } = await twoUsers();
  await connect(a, "client-1", "Test AI");
  await connect(b, "client-1", "Test AI");
  await connect(a, "https://tool.example.test/meta.json", "");

  expect((await aiConnections(a)).map((c) => [c.name, c.scopes])).toEqual([
    ["tool.example.test", ["library:read", "library:write"]],
    ["Test AI", ["library:read", "library:write"]],
  ]);
  expect(await isAiConnected(a, "client-1")).toBe(true);

  expect(await disconnectAi(a, "client-1")).toBe(true);
  expect(await isAiConnected(a, "client-1")).toBe(false);
  expect(await isAiConnected(b, "client-1")).toBe(true); // the other person keeps theirs
  expect(await (await db()).collection("oauthRefreshToken").countDocuments({ userId: oid(a), clientId: "client-1" })).toBe(0);
  expect(await disconnectAi(a, "client-1")).toBe(false);
});

test("old grants lose delete and the account, for every person, except our own apps'", async () => {
  const { a, b } = await twoUsers();
  const d = await db();
  const ours = "http://ours.test/extension/connected";
  await d.collection("oauthClient").insertMany([
    { clientId: "narrow-ai", redirectUris: ["https://ai.example.test/cb"] },
    { clientId: "narrow-ext", redirectUris: [ours] },
    { clientId: "narrow-mixed", redirectUris: [ours, "https://ai.example.test/cb"] },
  ]);
  const all = ["offline_access", "library:read", "library:write", "library:delete", "account"];
  for (const userId of [a, b])
    for (const clientId of ["narrow-ai", "narrow-ext", "narrow-mixed", "narrow-unknown"]) {
      await d.collection("oauthConsent").insertOne({ clientId, userId: oid(userId), scopes: all, createdAt: new Date() });
      await d.collection("oauthRefreshToken").insertOne({ clientId, userId: oid(userId), token: `${clientId}-${userId}`, scopes: all });
    }

  expect(await narrowAiGrants([ours])).toBe(6);
  for (const name of ["oauthConsent", "oauthRefreshToken"]) {
    const rows = await d.collection(name).find({ clientId: /^narrow-/, userId: { $in: [oid(a), oid(b)] } }).toArray();
    for (const r of rows) expect(r.scopes).toEqual(r.clientId === "narrow-ext" ? all : ["offline_access", "library:read", "library:write"]);
  }
  expect(await narrowAiGrants([ours])).toBe(0); // safe to run again
});
