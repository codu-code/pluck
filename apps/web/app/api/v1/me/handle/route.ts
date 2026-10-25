import { json, route } from "@/lib/api";
import { makeUpHandle } from "@/lib/library";

// "Make one up": a fresh made-up handle. A handle someone chose still waits its month.
export const POST = route({ kind: "write" }, async ({ caller }) => json({ me: await makeUpHandle(caller.userId) }));
