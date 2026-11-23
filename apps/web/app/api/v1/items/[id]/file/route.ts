import { FileArrivedBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { fileArrived, fileLocation } from "@/lib/library";

// A PDF's kept file, as a short-lived signed URL (JSON, so the download needs no Authorization header). `?as=view` and
// `?as=download` redirect to it instead, shown in the page or saved, for the web's viewer and its Download.
export const GET = route<{ id: string }>({ kind: "read" }, async ({ req, caller, params }) => {
  const as = new URL(req.url).searchParams.get("as");
  if (as === "view" || as === "download") return new Response(null, { status: 302, headers: { location: await fileLocation(caller.userId, params.id, as) } });
  return json({ url: await fileLocation(caller.userId, params.id) });
});

// The upload begun at POST /items/files is in: the file is read now, so its picture or its words show at once.
export const POST = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) => {
  return json({ item: await fileArrived(caller.userId, params.id, await parseBody(req, FileArrivedBody)) });
});
