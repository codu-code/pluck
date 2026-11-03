import { countAnonymous } from "@pluck/db";
import { ExtensionRemovedReason } from "@pluck/shared-schemas";
import { publicRoute } from "@/lib/api";
import { ORIGIN } from "@/lib/origin";

// The extension's uninstall URL lands here: counted, with nobody named (no cookie, no account, no PostHog), then on to
// the goodbye page. Anyone could call it, so the count is a rough number for us, never a figure to publish.
export const GET = publicRoute("extension-bye", 10, async () => {
  await countAnonymous("extension-removed");
  return Response.redirect(new URL("/extension/bye", ORIGIN), 303);
});

// The goodbye page's one question. A form, so a crawler following links answers nothing.
export const POST = publicRoute("extension-bye", 10, async ({ req }) => {
  const why = ExtensionRemovedReason.safeParse((await req.formData().catch(() => null))?.get("why"));
  if (why.success) await countAnonymous(`extension-removed:${why.data}`);
  return Response.redirect(new URL(why.success ? "/extension/bye?thanks=1" : "/extension/bye", ORIGIN), 303);
});
