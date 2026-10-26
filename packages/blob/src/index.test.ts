import { expect, test } from "vitest";
import { TooLarge, deletePrefix, getObject, putObject, signedUrl } from "./index.ts";

test("put, read back, sign and delete against MinIO", async () => {
  const prefix = `test/${Date.now()}/`;
  await putObject(`${prefix}a.txt`, "hello", "text/plain");
  expect((await getObject(`${prefix}a.txt`)).toString()).toBe("hello");
  const res = await fetch(await signedUrl(`${prefix}a.txt`));
  expect(await res.text()).toBe("hello");
  expect(await deletePrefix(prefix)).toBe(1);
});

test("getObject refuses an object over maxBytes", async () => {
  const prefix = `test/${Date.now()}-max/`;
  await putObject(`${prefix}a.txt`, "hello", "text/plain");
  expect((await getObject(`${prefix}a.txt`, { maxBytes: 5 })).toString()).toBe("hello");
  await expect(getObject(`${prefix}a.txt`, { maxBytes: 4 })).rejects.toBeInstanceOf(TooLarge);
  await deletePrefix(prefix);
});
