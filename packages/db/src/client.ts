import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;

// Pool capped at 10 per instance (shared Atlas cluster guardrail).
export function getClient(uri = process.env.MONGODB_URI): MongoClient {
  if (!uri) throw new Error("MONGODB_URI is not set");
  client ??= new MongoClient(uri, { maxPoolSize: 10 });
  return client;
}

export function getDb(): Db {
  return getClient().db();
}

export async function ping(): Promise<boolean> {
  const res = await getDb().command({ ping: 1 });
  return res.ok === 1;
}
