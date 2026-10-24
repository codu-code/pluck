import { json, route } from "@/lib/api";
import { sendDigest } from "@/lib/library";

// "Send me one now" from Settings: the digest as it would look today, whatever the day.
export const POST = route({ kind: "write" }, async ({ caller }) => json({ sent: await sendDigest(caller.userId, { force: true }) }));
