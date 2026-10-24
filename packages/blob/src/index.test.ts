import { expect, test } from "vitest";
import { deletePrefix, getObject, putObject, signedUrl } from "./index.ts";

test("put, read back, sign and delete against MinIO", async () => {
  const prefix = `test/${Date.now()}/`;
  await putObject(`${prefix}a.txt`, "hello", "text/plain");
  expect((await getObject(`${prefix}a.txt`)).toString()).toBe("hello");
  const res = await fetch(await signedUrl(`${prefix}a.txt`));
  expect(await res.text()).toBe("hello");
  expect(await deletePrefix(prefix)).toBe(1);
});
