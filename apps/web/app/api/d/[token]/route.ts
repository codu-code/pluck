import { publicRoute } from "@/lib/api";
import { runTap } from "@/lib/library";

// Signed digest links land here as a POST: from the /d page (one tap, or a confirm for Archive it all),
// or from a mail client's one-click unsubscribe. A link opened by a scanner (GET) never acts.
export const POST = publicRoute<{ token: string }>(30, async ({ req, params }) => {
  const form = await req.formData().catch(() => null);
  const confirm = form?.get("confirm") === "1";
  const res = await runTap(params.token, { confirm });
  const q = new URLSearchParams({ a: res.action, ...(res.undo ? { undo: res.undo } : {}), ...(res.count !== undefined ? { count: String(res.count) } : {}), ...(confirm ? { done: "1" } : {}) });
  if (form?.get("List-Unsubscribe") === "One-Click") return new Response(null, { status: 204 });
  return new Response(null, { status: 303, headers: { location: res.action === "archive-all" && !confirm ? `/d/${params.token}?${q}` : `/d/done?${q}` } });
});
