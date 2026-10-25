import { z } from "zod";
import { clientIp, json, parseBody, publicRoute } from "@/lib/api";
import { sendAppCode } from "@/lib/signin-code";
import { localeFrom } from "@/i18n/request";

// The iPhone app's sign-in, step one: email a 6-digit code (lib/signin-code.ts).
export const POST = publicRoute(30, async ({ req }) => {
  const { email } = await parseBody(req, z.object({ email: z.string().trim().email().max(320) }));
  return json(await sendAppCode(email, clientIp(req), localeFrom(req.headers)));
});
