import { ReportBody } from "@pluck/shared-schemas";
import { clientIp, parseBody, publicRoute } from "@/lib/api";
import { report } from "@/lib/library";

// Report a public list. No auth; a few a minute per address.
export const POST = publicRoute(5, async ({ req }) => {
  const b = await parseBody(req, ReportBody);
  await report(b.listId, clientIp(req), b.reason, b.details);
  return new Response(null, { status: 204 });
});
