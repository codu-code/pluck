import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;

// The driver (mongodb 7) keeps the topology of a first connect that failed, closed, and its auto-connect only
// connects when there is no topology: every later query answers "Topology is closed" until the process dies. A
// brief Atlas election at the wrong moment broke warm instances that way. So connect at once, and if that fails,
// connect again (connect() replaces a topology that is not connected) with backoff until it holds.
export function keepConnected(c: MongoClient, { firstDelayMs = 1000, maxDelayMs = 30_000 } = {}): Promise<void> {
  return new Promise((resolve) => {
    const attempt = (delay: number) =>
      c.connect().then(() => resolve(), () => setTimeout(() => attempt(Math.min(delay * 2, maxDelayMs)), delay).unref());
    attempt(firstDelayMs);
  });
}

// Pool capped at 10 per instance (shared Atlas cluster guardrail).
export function getClient(uri = process.env.MONGODB_URI): MongoClient {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 10 });
    void keepConnected(client);
  }
  return client;
}

export function getDb(): Db {
  return getClient().db();
}

export async function ping(): Promise<boolean> {
  const res = await getDb().command({ ping: 1 });
  return res.ok === 1;
}
