import { z } from "zod";
import { clientIp, json, parseBody, publicRoute } from "@/lib/api";
import { appRedirectFromCode } from "@/lib/signin-code";

// The iPhone app's sign-in, step two: the code from the email (or App Review's password) for the app's own OAuth
// request (lib/signin-code.ts).
export const POST = publicRoute(30, async ({ req }) => {
  const body = await parseBody(req, z.union([
    z.object({ email: z.string().trim().email().max(320), code: z.string().regex(/^\d{6}$/), authorize: z.string().max(4096) }),
    z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256), authorize: z.string().max(4096) }),
  ]));
  return json({ url: await appRedirectFromCode({ ...body, ip: clientIp(req) }) });
});
