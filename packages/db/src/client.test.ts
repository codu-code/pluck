import { createServer, connect as tcp, type AddressInfo, type Server } from "node:net";
import { MongoClient } from "mongodb";
import { expect, test } from "vitest";
import { keepConnected } from "./client.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db = new URL(process.env.MONGODB_URI!.replace(/^mongodb:/, "http:")); // the test database, host and port

test("a client whose first connect failed connects once the database is back", async () => {
  // A free port with nothing on it yet: connecting there fails like an Atlas election with no primary.
  const free = createServer().listen(0, "127.0.0.1");
  await new Promise((r) => free.once("listening", r));
  const port = (free.address() as AddressInfo).port;
  await new Promise((r) => free.close(r));

  const c = new MongoClient(`mongodb://127.0.0.1:${port}/x?directConnection=true&serverSelectionTimeoutMS=300`);
  const connected = keepConnected(c, { firstDelayMs: 100, maxDelayMs: 200 });
  await sleep(700);
  await expect(c.db().command({ ping: 1 })).rejects.toThrow(); // the closed topology the driver keeps

  // The database comes back on that port (a proxy to the test one).
  const proxy: Server = createServer((sock) => {
    const up = tcp(Number(db.port), db.hostname);
    sock.pipe(up).pipe(sock);
    up.on("error", () => sock.destroy());
    sock.on("error", () => up.destroy());
  }).listen(port, "127.0.0.1");
  try {
    await connected;
    expect((await c.db().command({ ping: 1 })).ok).toBe(1);
  } finally {
    await c.close();
    await new Promise((r) => proxy.close(r));
  }
});
