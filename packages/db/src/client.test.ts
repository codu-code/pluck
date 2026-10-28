import { createServer, connect as tcp, type AddressInfo, type Server } from "node:net";
import { MongoClient } from "mongodb";
import { expect, test } from "vitest";
import { reconnectWhenClosed } from "./client.ts";

const db = new URL(process.env.MONGODB_URI!.replace(/^mongodb:/, "http:")); // the test database, host and port

test("a client whose connect failed connects again on the next query once the database is back", async () => {
  // A free port with nothing on it yet: connecting there fails like an Atlas election with no primary, or a
  // serverless instance frozen mid-connect.
  const free = createServer().listen(0, "127.0.0.1");
  await new Promise((r) => free.once("listening", r));
  const port = (free.address() as AddressInfo).port;
  await new Promise((r) => free.close(r));

  const c = reconnectWhenClosed(new MongoClient(`mongodb://127.0.0.1:${port}/x?directConnection=true&serverSelectionTimeoutMS=300`));
  await expect(c.connect()).rejects.toThrow();
  await expect(c.db().command({ ping: 1 })).rejects.toThrow(); // still down: this query's own connect fails too

  // The database comes back on that port (a proxy to the test one).
  const proxy: Server = createServer((sock) => {
    const up = tcp(Number(db.port), db.hostname);
    sock.pipe(up).pipe(sock);
    up.on("error", () => sock.destroy());
    sock.on("error", () => up.destroy());
  }).listen(port, "127.0.0.1");
  try {
    expect((await c.db().command({ ping: 1 })).ok).toBe(1); // no wait, no timer: the query reconnects
  } finally {
    await c.close();
    await new Promise((r) => proxy.close(r));
  }
});

test("a closed client stays closed", async () => {
  const c = reconnectWhenClosed(new MongoClient(process.env.MONGODB_URI!));
  await c.connect();
  await c.close();
  await expect(c.db().command({ ping: 1 })).rejects.toThrow(/must be connected/);
});
