import { expect, test } from "vitest";
import { ping } from "./index.ts";
import { twoUsers } from "./testing.ts";

test("each test file gets its own database and two distinct users", async () => {
  expect(process.env.MONGODB_URI).toMatch(/\/pluck_test_/);
  expect(await ping()).toBe(true);
  const { a, b } = await twoUsers();
  expect(a).not.toBe(b);
});
