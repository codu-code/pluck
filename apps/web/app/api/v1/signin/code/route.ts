import { z } from "zod";
import { clientIp, json, parseBody, publicRoute } from "@/lib/api";
import { appRedirectFromCode } from "@/lib/signin-code";

// The 6-digit code from the sign-in email, typed in the iPhone app: lib/signin-code.ts.
export const POST = publicRoute(30, async ({ req }) => {
  const body = await parseBody(req, z.object({
    email: z.string().trim().email().max(320),
    code: z.string().regex(/^\d{6}$/),
    authorize: z.string().max(4096), // the app's authorization request, as a query string
  }));
  return json({ url: await appRedirectFromCode({ ...body, ip: clientIp(req) }) });
});
