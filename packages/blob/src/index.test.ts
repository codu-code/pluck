import { expect, test } from "vitest";
import { TooLarge, deletePrefix, getObject, listKeys, putObject, signedPutUrl, signedUrl } from "./index.ts";

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

test("a signed upload link takes only the declared type and size", async () => {
  const key = `test/${Date.now()}-put/a.png`;
  const url = await signedPutUrl(key, "image/png", 5);
  expect(new URL(url).searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
  const put = (body: string, type: string) => fetch(url, { method: "PUT", headers: { "content-type": type }, body });
  expect((await put("longer", "image/png")).status).toBe(403);
  expect((await put("shrt", "image/png")).status).toBe(403);
  expect((await put("hello", "text/html")).status).toBe(403);
  expect(await listKeys(key)).toEqual([]);
  expect((await put("hello", "image/png")).status).toBe(200);
  expect(await listKeys(key)).toEqual([{ key, size: 5 }]);
  await deletePrefix(key);
});
