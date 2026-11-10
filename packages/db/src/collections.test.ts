import { Collection } from "mongodb";
import { expect, test, vi } from "vitest";
import { db, items } from "./collections.ts";

test("a first try that fails is not kept: the next query makes the indexes and runs", async () => {
  // The process's first call: one createIndexes fails, as it does when the database blips at start.
  const blip = vi.spyOn(Collection.prototype, "createIndexes").mockRejectedValueOnce(new Error("blip"));
  await expect(db()).rejects.toThrow("blip");
  expect(await (await items()).countDocuments({})).toBe(0);
  expect((await (await items()).indexes()).some((i) => i.name === "search_by_user")).toBe(true);
  blip.mockRestore();
});
