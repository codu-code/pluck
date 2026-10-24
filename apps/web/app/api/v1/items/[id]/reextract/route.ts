import { after } from "next/server";
import { json, route } from "@/lib/api";
import { retryExtraction } from "@/lib/library";

export const POST = route<{ id: string }>({ kind: "write" }, async ({ caller, params }) => {
  return json({ item: await retryExtraction(caller.userId, params.id, { defer: after }) });
});
