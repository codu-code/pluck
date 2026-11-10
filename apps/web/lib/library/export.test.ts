import { getObject, listKeys } from "@pluck/blob";
import { createList, latestExport, startExport } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { unzipSync } from "fflate";
import { expect, test } from "vitest";
import { exportState, requestExport, runExport, sweepTransfersNow } from "./account";

test("lists whose names differ only in punctuation each get their own file in the export", async () => {
  const { a } = await twoUsers();
  await createList(a, { name: "Books", createdBy: "user", items: [] });
  await createList(a, { name: "books!", createdBy: "user", items: [] });
  await runExport(a, await startExport(a));
  const zip = unzipSync(new Uint8Array(await getObject((await latestExport(a))!.blobKey!)));
  expect(Object.keys(zip).filter((f) => f.startsWith("lists/"))).toHaveLength(2);
});

test("five exports a day each: the sixth is refused, and someone else is not held up", async () => {
  const { a, b } = await twoUsers();
  for (let i = 0; i < 5; i++) await requestExport(a);
  await expect(requestExport(a)).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  await expect(requestExport(b)).resolves.toHaveProperty("id");
});

test("the daily sweep removes an export's zip once its emailed link has run out, and no sooner", async () => {
  const { a } = await twoUsers();
  await runExport(a, await startExport(a));
  await sweepTransfersNow();
  expect(await listKeys(`u/${a}/exports/`)).toHaveLength(1);
  await sweepTransfersNow(new Date(Date.now() + 9 * 86_400_000));
  expect(await listKeys(`u/${a}/exports/`)).toEqual([]);
  expect(await exportState(a)).toBeNull();
});
