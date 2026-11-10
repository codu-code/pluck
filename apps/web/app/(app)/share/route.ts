import { CreateItemBody } from "@pluck/shared-schemas";
import { after } from "next/server";
import { ApiError, authenticate, publicRoute } from "@/lib/api";
import { pluckAny } from "@/lib/library";
import { ORIGIN } from "@/lib/origin";

const to = (path: string) => Response.redirect(`${ORIGIN}${path}`, 303);

// Share to Pluck on Android (the share_target in app/manifest.ts). What was shared is plucked as if it had been
// pasted into the box: the links in it, or a Note when it has none. Android puts the link in `text`, sometimes in `url`.
//
// This is a GET that writes, so any page could link here. It plucks only when the browser itself started the
// navigation (Sec-Fetch-Site: none, which a share is and a link on a page never is). Anything else, a browser
// that sends no such header included, lands on the box holding what was shared (./add), where the person plucks it
// or does not. So does the way back from signing in: that address is one a stranger can make too.
export const GET = publicRoute("share", 30, async ({ req }) => {
  const q = new URL(req.url).searchParams;
  const text = ([q.get("text"), q.get("url")].filter(Boolean).join("\n") || q.get("title") || "").trim();
  if (!text) return to("/inbox");
  const body = CreateItemBody.parse({ text, source: "web" });
  const add = `/share/add?${new URLSearchParams({ text })}`;
  const caller = await authenticate(req);
  if (!caller) return to(`/signin?${new URLSearchParams({ next: add })}`);
  if (req.headers.get("sec-fetch-site") !== "none") return to(add);
  try {
    await pluckAny(caller.userId, body, { defer: after });
  } catch (e) {
    if (e instanceof ApiError) return to(add); // over the hour's links, say: the box says why when they press Pluck it
    throw e;
  }
  return to("/inbox");
});
