import { countAnonymous } from "@pluck/db";
import { ExtensionRemovedReason } from "@pluck/shared-schemas";
import { publicRoute } from "@/lib/api";
import { ORIGIN } from "@/lib/origin";

// The extension's uninstall URL lands here, and so does each answer on the goodbye page: counted, with nobody named
// (no cookie, no account, no PostHog), then on to the page.
export const GET = publicRoute("extension-bye", 10, async ({ req }) => {
  const why = ExtensionRemovedReason.safeParse(new URL(req.url).searchParams.get("why"));
  await countAnonymous(why.success ? `extension-removed:${why.data}` : "extension-removed");
  return Response.redirect(new URL(why.success ? "/extension/bye?thanks=1" : "/extension/bye", ORIGIN), 303);
});
