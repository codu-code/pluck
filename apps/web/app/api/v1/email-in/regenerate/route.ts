import { json, route } from "@/lib/api";
import { newEmailInAddress } from "@/lib/library";

// A new address; the old one stops working at once.
export const POST = route({ kind: "write" }, async ({ caller }) => json({ address: await newEmailInAddress(caller.userId) }));
