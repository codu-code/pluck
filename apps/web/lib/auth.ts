import { authAdapter, hitRateLimit } from "@pluck/db";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { jwt, magicLink } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sendEmail } from "./email";
import { magicLinkEmail } from "./emails";
import { linkPageUrl } from "./signin-link";
import { clientIp } from "./ip";

const DAY = 60 * 60 * 24;

// Every OAuth token is bound (aud) to one protected resource: the connector for AI tools,
// or the REST API for our own apps (the extension, iOS).
const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
export const MCP_RESOURCE = `${ORIGIN}/mcp`;
export const API_RESOURCE = `${ORIGIN}/api/v1`;
export const LIBRARY_SCOPES = ["library:read", "library:write", "library:delete"] as const;
// Account settings a browser session has (connected AI tools, export, deleting it all), for our own apps only.
export const ACCOUNT_SCOPE = "account";
// Where the extension and the iPhone app take their sign-in back. Codes sent here never leave our apps.
export const FIRST_PARTY_REDIRECTS = [`${ORIGIN}/extension/connected`, "io.getpluck.app:/oauth"];
const LIMITS_ON = process.env.AUTH_RATE_LIMIT !== "off";

const firstParty = (uris: unknown) => Array.isArray(uris) && uris.length > 0 && uris.every((u) => FIRST_PARTY_REDIRECTS.includes(u));

const guard = createAuthMiddleware(async (ctx) => {
  // Anyone can register a client. Only our own apps get the REST API and the account scope, and only they may go by Pluck's name,
  // so a look-alike client cannot borrow the extension's consent screen.
  if (ctx.path === "/oauth2/register") {
    const body = (ctx.body ?? {}) as { resources?: unknown; client_name?: unknown; redirect_uris?: unknown; scope?: unknown };
    const wantsApi = Array.isArray(body.resources) && body.resources.includes(API_RESOURCE);
    const wantsAccount = String(body.scope ?? "").split(" ").includes(ACCOUNT_SCOPE);
    if ((wantsApi || wantsAccount || /pluck/i.test(String(body.client_name ?? ""))) && !firstParty(body.redirect_uris))
      throw new APIError("BAD_REQUEST", { error: "invalid_client_metadata", error_description: "Only Pluck's own apps can register for the Pluck API or use its name." });
  }
  // Each link is an email we pay for and a mailbox someone else owns: a few an hour per address and per network.
  if (ctx.path === "/sign-in/magic-link" && LIMITS_ON) {
    const email = String((ctx.body as { email?: unknown } | undefined)?.email ?? "").trim().toLowerCase();
    for (const [key, max] of [[`magic:email:${email}`, 6], [`magic:ip:${clientIp({ headers: ctx.headers ?? new Headers() })}`, 30]] as const)
      if (!(await hitRateLimit(key, max, 3600)).ok) throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in links. Try again in an hour." });
  }
});

export const auth = betterAuth({
  database: authAdapter(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  user: { modelName: "users" },
  // Imported when used: the library reaches site.ts, which imports this file.
  databaseHooks: { user: { create: { after: async (user) => (await import("./library")).queueWelcome(user.id) } } },
  session: { modelName: "auth_sessions", expiresIn: 30 * DAY, updateAge: DAY },
  account: { modelName: "auth_accounts" },
  verification: { modelName: "auth_verifications" },
  // In-memory limits reset per serverless instance; the database is shared.
  // AUTH_RATE_LIMIT=off is for the e2e server only, which signs in from one IP many times a minute.
  // Better Auth's defaults stand (100 per 10 s per IP; sign-in 3 per 10 s); registering a client is rarer still.
  rateLimit: {
    storage: "database",
    modelName: "auth_rate_limits",
    enabled: LIMITS_ON,
    customRules: { "/oauth2/register": { window: 3600, max: 20 } },
  },
  hooks: { before: guard },
  onAPIError: { errorURL: "/oauth/error" }, // a failed OAuth request from an AI tool lands on a page that says so
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      sendMagicLink: ({ email, url }) => sendEmail(magicLinkEmail(email, linkPageUrl(url))),
    }),
    // OAuth 2.1 for MCP clients, the extension and iOS: JWT access tokens bound to one resource.
    jwt(),
    mcp({
      loginPage: "/signin",
      consentPage: "/oauth/consent",
      resource: MCP_RESOURCE,
      scopes: ["openid", "profile", "email", "offline_access", ...LIBRARY_SCOPES, ACCOUNT_SCOPE],
      accessTokenExpiresIn: 60 * 60,
      refreshTokenExpiresIn: 90 * DAY,
      // CIMD first; dynamic registration as the fallback for clients that do not speak CIMD yet.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
      clientRegistrationDefaultScopes: ["offline_access", "library:read", "library:write"],
      clientRegistrationAllowedScopes: ["openid", "profile", "email", "offline_access", ...LIBRARY_SCOPES, ACCOUNT_SCOPE],
      resources: [API_RESOURCE],
      clientRegistrationAllowedResources: [API_RESOURCE],
    }),
    cimd({
      // Dev and tests use plain fetch (looked up per call, so tests can stand in for the client's server); prod uses the guarded Node transport.
      fetchClientMetadataResource: process.env.ALLOW_PRIVATE_FETCH === "1" ? (input, init) => fetch(input, init) : fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
  ],
});

export type SessionUser = { id: string; email: string; name: string };

// For server components and pages: the signed-in user, or null. Once per request: the layout, the page and its
// metadata all ask.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null;
});

// For pages inside (app): Next renders a layout and its page side by side, so the layout's redirect alone
// does not stop the page from running signed out.
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}
