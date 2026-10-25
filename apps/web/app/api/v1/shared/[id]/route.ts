import { json, route } from "@/lib/api";
import { leaveShared, readShared } from "@/lib/library";

// One List shared with the signed-in person, in the public page's shape. DELETE takes it off their Lists.
export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => json(await readShared(caller.userId, params.id)));

export const DELETE = route<{ id: string }>({ kind: "write" }, async ({ caller, params }) => {
  await leaveShared(caller.userId, params.id);
  return new Response(null, { status: 204 });
});
