import { json, route } from "@/lib/api";
import { emailInAddress } from "@/lib/library";

export const GET = route({ kind: "read" }, async ({ caller }) => json({ address: await emailInAddress(caller.userId) }));
