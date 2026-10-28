import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;

// The driver (mongodb 7) keeps the topology of a connect that failed, closed, and its auto-connect only connects when
// there is no topology: every later query answers "Topology is closed" until the process dies. On Vercel an instance
// frozen mid-connect thaws to exactly that, and a retry on a timer is frozen with it. So drop a closed topology: the
// next query connects again, inside the request that needs it. close() drops its own first, so this leaves it alone.
export function reconnectWhenClosed(c: MongoClient): MongoClient {
  const inner = c as unknown as { topology?: { s: { id: number } } }; // why: `topology` is the driver's, not in its types
  c.on("topologyClosed", (e) => {
    if (inner.topology?.s.id === e.topologyId) inner.topology = undefined;
  });
  return c;
}

// Pool capped at 10 per instance (shared Atlas cluster guardrail).
export function getClient(uri = process.env.MONGODB_URI): MongoClient {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!client) {
    client = reconnectWhenClosed(new MongoClient(uri, { maxPoolSize: 10 }));
    client.connect().catch(() => {}); // warm up; a failure is retried by the first query
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
