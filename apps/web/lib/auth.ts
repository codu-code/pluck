import { authAdapter } from "@pluck/db";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { jwt, magicLink } from "better-auth/plugins";
import { headers } from "next/headers";
import { sendEmail } from "./email";
import { magicLinkEmail } from "./emails";

const DAY = 60 * 60 * 24;

// Every OAuth token is bound (aud) to one protected resource: the connector for AI tools,
// or the REST API for our own apps (the extension, iOS).
const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
export const MCP_RESOURCE = `${ORIGIN}/mcp`;
export const API_RESOURCE = `${ORIGIN}/api/v1`;
export const LIBRARY_SCOPES = ["library:read", "library:write", "library:delete"] as const;

export const auth = betterAuth({
  database: authAdapter(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  user: { modelName: "users" },
  session: { modelName: "auth_sessions", expiresIn: 30 * DAY, updateAge: DAY },
  account: { modelName: "auth_accounts" },
  verification: { modelName: "auth_verifications" },
  // In-memory limits reset per serverless instance; the database is shared.
  // AUTH_RATE_LIMIT=off is for the e2e server only, which signs in from one IP many times a minute.
  rateLimit: { storage: "database", modelName: "auth_rate_limits", enabled: process.env.AUTH_RATE_LIMIT !== "off" },
  onAPIError: { errorURL: "/oauth/error" }, // a failed OAuth request from an AI tool lands on a page that says so
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      sendMagicLink: ({ email, url }) => sendEmail(magicLinkEmail(email, url)),
    }),
    // OAuth 2.1 for MCP clients, the extension and iOS: JWT access tokens bound to one resource.
    jwt(),
    mcp({
      loginPage: "/signin",
      consentPage: "/oauth/consent",
      resource: MCP_RESOURCE,
      scopes: ["openid", "profile", "email", "offline_access", ...LIBRARY_SCOPES],
      accessTokenExpiresIn: 60 * 60,
      refreshTokenExpiresIn: 90 * DAY,
      // CIMD first; dynamic registration as the fallback for clients that do not speak CIMD yet.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
      clientRegistrationDefaultScopes: ["offline_access", "library:read", "library:write"],
      clientRegistrationAllowedScopes: ["openid", "profile", "email", "offline_access", ...LIBRARY_SCOPES],
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

// For server components and pages: the signed-in user, or null.
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null;
}
