import { json, route } from "@/lib/api";
import { sharedWithMe } from "@/lib/library";

// Lists other people shared with the signed-in person, See only.
export const GET = route({ kind: "read" }, async ({ caller }) => json({ lists: await sharedWithMe(caller.userId) }));
