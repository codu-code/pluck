import { expect, test } from "vitest";
import { numbers, pluckLink, setVia } from "./index.ts";
import { twoUsers } from "./testing.ts";

test("numbers count every account and Item, by where they came from", async () => {
  const before = await numbers();
  const { a, b } = await twoUsers();
  await setVia(a, "mcp");
  await pluckLink(a, { url: "https://example.com/n1", source: "extension" });
  await pluckLink(a, { url: "https://example.com/n2", source: "ios" });
  await pluckLink(b, { url: "https://example.com/n3", source: "extension" });
  const after = await numbers();
  expect(after.accounts - before.accounts).toBeGreaterThanOrEqual(2);
  expect((after.itemsBySource.extension ?? 0) - (before.itemsBySource.extension ?? 0)).toBeGreaterThanOrEqual(2);
  expect(after.viaThisWeek.mcp ?? 0).toBeGreaterThanOrEqual(1);
  expect(after.accountsBySurfaceCount["2"] ?? 0).toBeGreaterThanOrEqual(1);
});
