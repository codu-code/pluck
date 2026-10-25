import { ShareListBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { peopleOf, shareWith } from "@/lib/library";

// The people a List is shared with (See only). Adding one emails them a link.
export const GET = route<{ id: string }>({ kind: "read" }, async ({ caller, params }) => json({ people: await peopleOf(caller.userId, params.id) }));

export const POST = route<{ id: string }>({ kind: "write" }, async ({ req, caller, params }) =>
  json({ person: await shareWith(caller.userId, params.id, (await parseBody(req, ShareListBody)).email) }, 201),
);
