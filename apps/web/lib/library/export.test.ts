import { getObject } from "@pluck/blob";
import { createList, latestExport, startExport } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { unzipSync } from "fflate";
import { expect, test } from "vitest";
import { runExport } from "./account";

test("lists whose names differ only in punctuation each get their own file in the export", async () => {
  const { a } = await twoUsers();
  await createList(a, { name: "Books", createdBy: "user", items: [] });
  await createList(a, { name: "books!", createdBy: "user", items: [] });
  await runExport(a, await startExport(a));
  const zip = unzipSync(new Uint8Array(await getObject((await latestExport(a))!.blobKey!)));
  expect(Object.keys(zip).filter((f) => f.startsWith("lists/"))).toHaveLength(2);
});
