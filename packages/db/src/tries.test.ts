import { expect, test } from "vitest";
import { holdTry, MAX_HELD, takeTry } from "./tries.ts";

test("a hold is per token, capped, deduped, and taken only once", async () => {
  const a = await holdTry(null, ["https://example.test/1", "https://example.test/2"]);
  const b = await holdTry(null, ["https://example.test/b"]);
  expect(a.token).not.toBe(b.token);
  expect((await holdTry(a.token, ["https://example.test/2", "https://example.test/3"])).count).toBe(3);
  expect(await takeTry(b.token)).toEqual(["https://example.test/b"]);
  expect(await takeTry(a.token)).toEqual(["https://example.test/1", "https://example.test/2", "https://example.test/3"]);
  expect(await takeTry(a.token)).toEqual([]);
  expect(await takeTry("not-a-token")).toEqual([]);
  const many = await holdTry(null, Array.from({ length: 30 }, (_, i) => `https://example.test/${i}`));
  expect(many.count).toBe(MAX_HELD);
});

test("a hold older than a day is gone", async () => {
  const old = await holdTry(null, ["https://example.test/old"], new Date(Date.now() - 2 * 86_400_000));
  expect(await takeTry(old.token)).toEqual([]);
});
