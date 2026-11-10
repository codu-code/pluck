import { CreateItemBody } from "@pluck/shared-schemas";
import { after } from "next/server";
import { ApiError, authenticate, publicRoute } from "@/lib/api";
import { pluckAny } from "@/lib/library";
import { ORIGIN } from "@/lib/origin";

const to = (path: string) => Response.redirect(`${ORIGIN}${path}`, 303);

// Android puts the link in `text`, sometimes in `url`; with neither, the title is all there is.
const shared = (q: { get(name: string): unknown }) => {
  const s = (name: string) => (typeof q.get(name) === "string" ? (q.get(name) as string) : "");
  return ([s("text"), s("url")].filter(Boolean).join("\n") || s("title")).trim();
};
const add = (text: string) => `/share/add?${new URLSearchParams({ text })}`;

// Share to Pluck on Android (the share_target in app/manifest.ts). What was shared is plucked as if it had been
// pasted into the box: the links in it, or a Note when it has none.
//
// The share arrives as a POST, which only the installed app's share sheet and our own pages can send signed in: the
// session cookie is SameSite=Lax, so a form on another site arrives signed out, and a link (in a page, a chat, a QR
// code) is a GET, which never plucks. One on a sibling site (another port of this host) does carry the cookie, so a
// request the browser says came from another site lands on the box too (./add), where the person plucks it or not.
export const POST = publicRoute("share", 30, async ({ req }) => {
  const text = shared(await req.formData().catch(() => new FormData()));
  if (!text) return to("/inbox");
  const body = CreateItemBody.parse({ text, source: "web" });
  const caller = await authenticate(req);
  if (!caller) return to(`/signin?${new URLSearchParams({ next: add(text) })}`);
  if (["cross-site", "same-site"].includes(req.headers.get("sec-fetch-site") ?? "")) return to(add(text));
  try {
    await pluckAny(caller.userId, body, { defer: after });
  } catch (e) {
    if (e instanceof ApiError) return to(add(text)); // over the hour's links, say: the box says why when they press Pluck it
    throw e;
  }
  return to("/inbox");
});

// A link to /share plucks nothing, whoever made it: it opens the box holding what the link carried.
export const GET = publicRoute("share", 30, async ({ req }) => {
  const text = shared(new URL(req.url).searchParams);
  if (!text) return to("/inbox");
  return to((await authenticate(req)) ? add(text) : `/signin?${new URLSearchParams({ next: add(text) })}`);
});
