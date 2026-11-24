import { beforeEach, expect, test, vi } from "vitest";

// The browser as Options sees it: storage, the hosts the person has allowed, the tabs it opened; and the network,
// where some origins are Pluck servers and the rest are anything else.
const b = vi.hoisted(() => {
  const b = { local: {} as Record<string, unknown>, allow: true, asked: [] as string[], granted: new Set<string>(), tabs: [] as string[], calls: [] as string[], pluck: new Set<string>() };
  Object.assign(globalThis, {
    __DEFAULT_SERVER__: "https://getpluck.test",
    fetch: async (url: string) => {
      b.calls.push(url);
      const { origin, pathname } = new URL(url);
      if (pathname === "/api/auth/oauth2/register") return Response.json({ client_id: "c2" }, { status: 201 });
      if (pathname !== "/.well-known/oauth-authorization-server/api/auth") return new Response(null); // the revoke
      if (!b.pluck.has(origin)) return new Response("<html>Some other site</html>");
      return Response.json({ authorization_endpoint: `${origin}/api/auth/oauth2/authorize`, scopes_supported: ["openid", "offline_access", "library:read", "library:write"] });
    },
    browser: {
      storage: {
        local: { get: async (k: string) => ({ [k]: b.local[k] }), set: async (patch: object) => void Object.assign(b.local, patch) },
        session: { set: async () => {} },
      },
      permissions: {
        request: async ({ origins }: { origins: string[] }) => {
          b.asked.push(...origins);
          if (b.allow) origins.forEach((o) => b.granted.add(o));
          return b.allow;
        },
        remove: async ({ origins }: { origins: string[] }) => origins.every((o) => b.granted.delete(o)),
      },
      tabs: { create: async ({ url }: { url: string }) => void b.tabs.push(url) },
    },
  });
  return b;
});
import { hostPattern, switchServer, typedServer } from "./server";

const HOSTED = "https://getpluck.test";
const MINE = "https://pluck.example.test";
const waiting = [{ id: "q1", body: { url: "https://a.test", html: "<p>the whole page</p>" }, at: 1 }];
const settings = { server: HOSTED, defaultKind: "guess", sendContent: false, transcripts: true };
// Signed in at getpluck with OAuth, one pluck waiting to go up.
const signedIn = () => ({ settings, queue: waiting, tokens: { access: "a", refresh: "r1", expiresAt: Date.now() + 3_600_000 }, clientIds: { [`${HOSTED} offline_access library:read library:write library:delete`]: "c1" }, email: "u1@example.test" });

beforeEach(() => Object.assign(b, { local: signedIn(), allow: true, asked: [], granted: new Set(), tabs: [], calls: [], pluck: new Set([HOSTED, MINE, "http://localhost:3000", "http://localhost:3001"]) }));

test("a typed server becomes its origin: https anywhere, http only on this computer", () => {
  expect(typedServer("  https://pluck.example.test/inbox?status=later ")).toEqual({ origin: "https://pluck.example.test" });
  expect(typedServer("https://pluck.example.test:8443/")).toEqual({ origin: "https://pluck.example.test:8443" });
  expect(typedServer("http://localhost:3000")).toEqual({ origin: "http://localhost:3000" });
  expect(typedServer("http://127.0.0.1:3000/settings")).toEqual({ origin: "http://127.0.0.1:3000" });
  for (const plain of ["http://pluck.example.test", "http://192.168.1.20:3000", "http://localhost.example.test"]) expect(typedServer(plain)).toEqual({ error: "needsHttps" });
  for (const not of ["", "pluck.example.test", "localhost:3000", "ftp://pluck.example.test", "chrome://extensions", "mailto:me@example.test"]) expect(typedServer(not)).toEqual({ error: "notAddress" });
});

test("the browser is asked for the server's host alone, with no port", () => {
  expect(hostPattern("https://pluck.example.test:8443")).toBe("https://pluck.example.test/*");
  expect(hostPattern("http://localhost:3000")).toBe("http://localhost/*");
});

test("the browser is asked inside the click, and a no changes nothing", async () => {
  b.allow = false;
  const before = structuredClone(b.local);
  const outcome = switchServer(HOSTED, MINE);
  expect(b.asked).toEqual(["https://pluck.example.test/*"]); // already asked, before anything was awaited
  expect(await outcome).toBe("notAllowed");
  expect(b.local).toEqual(before); // the server, the session and the queue as they were
  expect(b.calls).toEqual([]); // nothing was sent anywhere
  expect(b.tabs).toEqual([]);
});

test("an address that is not a Pluck server changes nothing, and its host is given back", async () => {
  const before = structuredClone(b.local);
  expect(await switchServer(HOSTED, "https://other.example.test")).toBe("notPluck");
  expect(b.local).toEqual(before);
  expect([...b.granted]).toEqual([]);
  expect(b.calls).toEqual(["https://other.example.test/.well-known/oauth-authorization-server/api/auth"]);
  expect(b.tabs).toEqual([]);
});

test("a yes signs out of the old server, clears the queue, keeps the new server and opens sign-in there", async () => {
  expect(await switchServer(HOSTED, MINE)).toBe("using");
  expect(b.calls).toEqual([
    `${MINE}/.well-known/oauth-authorization-server/api/auth`, // is it Pluck
    `${HOSTED}/api/auth/oauth2/revoke`, // the old session ends at the old server
    `${MINE}/api/auth/oauth2/register`, // sign-in starts at the new one
  ]);
  expect(b.local).toMatchObject({ settings: { ...settings, server: MINE }, queue: [], tokens: null, apiKey: null, email: null, owner: null });
  expect([...b.granted]).toEqual(["https://pluck.example.test/*"]);
  expect(b.tabs).toHaveLength(1);
  expect(b.tabs[0]).toMatch(/^https:\/\/pluck\.example\.test\/api\/auth\/oauth2\/authorize\?.*client_id=c2/);
});

test("switching away gives the old server's host back: to another server, or home to the build's own", async () => {
  await switchServer(HOSTED, MINE);
  Object.assign(b.local, { queue: waiting, apiKey: "pk_live_u1" });
  expect(await switchServer(MINE, "http://localhost:3000")).toBe("using");
  expect([...b.granted]).toEqual(["http://localhost/*"]);
  expect(b.local).toMatchObject({ settings: { server: "http://localhost:3000" }, queue: [], apiKey: null });
  expect(await switchServer("http://localhost:3000", HOSTED)).toBe("using");
  expect([...b.granted]).toEqual(["https://getpluck.test/*"]); // in a real build this one is the install's own and stays
});

test("another port on the same host keeps the host: a move, and a wrong address", async () => {
  await switchServer(HOSTED, "http://localhost:3000");
  expect(await switchServer("http://localhost:3000", "http://localhost:3001")).toBe("using");
  expect([...b.granted]).toEqual(["http://localhost/*"]);
  expect(await switchServer("http://localhost:3001", "http://localhost:9999")).toBe("notPluck");
  expect([...b.granted]).toEqual(["http://localhost/*"]); // the server in use can still be reached
  expect(b.local).toMatchObject({ settings: { server: "http://localhost:3001" } });
});
