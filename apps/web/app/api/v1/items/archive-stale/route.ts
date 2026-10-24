import { ArchiveStaleBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { archiveItAll } from "@/lib/library";

// "Archive it all". dryRun returns the count for the confirm step.
export const POST = route({ kind: "write" }, async ({ req, caller }) => json(await archiveItAll(caller.userId, await parseBody(req, ArchiveStaleBody))));
