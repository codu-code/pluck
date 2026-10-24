import { z } from "zod";
import { after } from "next/server";
import { authenticate, json, parseBody, publicRoute, TRY_COOKIE, tryToken } from "@/lib/api";
import { holdPaste, pluckAny } from "@/lib/library";

const Body = z.object({ text: z.string().trim().min(1).max(5000) });

// The home page paste box. Signed in: a real pluck. A visitor: held for a day against a cookie until they sign up.
export const POST = publicRoute(10, async ({ req }) => {
  const { text } = await parseBody(req, Body);
  const caller = await authenticate(req);
  if (caller) {
    const res = await pluckAny(caller.userId, { text, source: "web" }, { defer: after });
    return json({ signedIn: true, count: res.results.length });
  }
  const held = await holdPaste(tryToken(req.headers.get("cookie")), text);
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return json({ signedIn: false, count: held.held }, 200, {
    "set-cookie": `${TRY_COOKIE}=${held.token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure}`,
  });
});
