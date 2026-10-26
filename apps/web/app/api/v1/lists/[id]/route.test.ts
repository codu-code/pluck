import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { newKey, newList } from "@/lib/library";
import { DELETE as deleteHighlight } from "../../highlights/[id]/route";
import { DELETE as deleteTag } from "../../tags/[id]/route";
import { DELETE as deleteList } from "./route";

test("deleting a List, a Tag or a highlight needs library:delete, like deleting an Item", async () => {
  const { a } = await twoUsers();
  const { key } = await newKey(a, "script"); // read and write, the default
  const { key: deleter } = await newKey(a, "cleanup", ["library:read", "library:write", "library:delete"]);
  const list = await newList(a, { name: "Keep me" });
  const call = (handler: typeof deleteList, url: string, id: string, bearer: string) =>
    handler(new Request(url, { method: "DELETE", headers: { authorization: `Bearer ${bearer}` } }), { params: Promise.resolve({ id }) });

  const id = "0".repeat(24); // refused before anything is looked up
  for (const [handler, path] of [[deleteList, "lists"], [deleteTag, "tags"], [deleteHighlight, "highlights"]] as const)
    expect((await call(handler, `http://x/api/v1/${path}/${id}`, id, key)).status).toBe(403);
  expect((await call(deleteList, `http://x/api/v1/lists/${list.id}`, list.id, key)).status).toBe(403);
  expect((await call(deleteList, `http://x/api/v1/lists/${list.id}`, list.id, deleter)).status).toBe(204);
});
