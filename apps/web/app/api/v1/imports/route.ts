import { CreateImportBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { beginImport } from "@/lib/library";

// Step 1 of an import: a record and a signed URL to PUT the file to. Then POST /imports/:id/start.
export const POST = route({ kind: "write" }, async ({ req, caller }) => json(await beginImport(caller.userId, (await parseBody(req, CreateImportBody)).source), 201));
