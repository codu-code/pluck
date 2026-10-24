import { CreateTagBody } from "@pluck/shared-schemas";
import { json, parseBody, route } from "@/lib/api";
import { addTag, tagsOf } from "@/lib/library";

export const GET = route({ kind: "read" }, async ({ caller }) => json({ tags: await tagsOf(caller.userId) }));

export const POST = route({ kind: "write" }, async ({ req, caller }) => {
  const { tag, created } = await addTag(caller.userId, (await parseBody(req, CreateTagBody)).name);
  return json({ tag, created }, created ? 201 : 200);
});
