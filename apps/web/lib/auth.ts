import { authAdapter } from "@pluck/db";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { headers } from "next/headers";
import { sendEmail } from "./email";
import { magicLinkEmail } from "./emails";

const DAY = 60 * 60 * 24;

export const auth = betterAuth({
  database: authAdapter(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  user: { modelName: "users" },
  session: { modelName: "auth_sessions", expiresIn: 30 * DAY, updateAge: DAY },
  account: { modelName: "auth_accounts" },
  verification: { modelName: "auth_verifications" },
  // In-memory limits reset per serverless instance; the database is shared.
  rateLimit: { storage: "database", modelName: "auth_rate_limits" },
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      sendMagicLink: ({ email, url }) => sendEmail(magicLinkEmail(email, url)),
    }),
  ],
});

export type SessionUser = { id: string; email: string; name: string };

// For server components and pages: the signed-in user, or null.
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null;
}
