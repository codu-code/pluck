import { SharedReportBody } from "@pluck/shared-schemas";
import { parseBody, route } from "@/lib/api";
import { reportShared } from "@/lib/library";

// Report a List someone shared with you. It goes to a person, with the reports from public pages.
export const POST = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  const b = await parseBody(req, SharedReportBody);
  await reportShared(caller.userId, params.id, b.reason, b.details);
  return new Response(null, { status: 204 });
});
