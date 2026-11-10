import { ShareListBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { peopleOf, shareWith } from "@/lib/library";

// The people a List is shared with (See only). Adding one emails them a link.
export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => json({ people: await peopleOf(caller.userId, params.id) }));

// Sharing is the person's own act, like making a List public: their browser or one of our own apps, never a key.
export const POST = route<{ id: string }>({ kind: "write", scope: "account" }, async ({ req, caller, params }) =>
  json({ person: await shareWith(caller.userId, params.id, (await parseBody(req, ShareListBody)).email) }, 201),
);
