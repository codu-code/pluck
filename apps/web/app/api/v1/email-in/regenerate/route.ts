import { json, route } from "@/lib/api";
import { newEmailInAddress } from "@/lib/library";

// A new address; the old one stops working at once.
// A new address cuts off everything that mails the old one: the person's act, not a key's.
export const POST = route({ kind: "write", scope: "account" }, async ({ caller }) => json({ address: await newEmailInAddress(caller.userId) }));
