import { twoUsers } from "@pluck/db/testing";
import { expect, test } from "vitest";
import { newKey } from "@/lib/library";
import { PUT } from "./route";

test("a cover over 2 MB is refused, by its content-length or, without one, while it is read", async () => {
  const { a } = await twoUsers();
  const { key } = await newKey(a, "extension");
  const id = "0".repeat(24); // refused before the item is looked up
  const put = (body: BodyInit, headers: Record<string, string> = {}) =>
    PUT(
      new Request(`http://x/api/v1/items/${id}/cover`, {
        method: "PUT", body, headers: { authorization: `Bearer ${key}`, "content-type": "image/png", ...headers }, duplex: "half",
      } as RequestInit), // why: `duplex` (needed for a stream body) is not in the DOM RequestInit type yet
      { params: Promise.resolve({ id }) },
    );

  const refused = async (res: Response) => [res.status, ((await res.json()) as { error: { message: string } }).error.message];

  expect(await refused(await put("tiny", { "content-length": "2000001" }))).toEqual([400, "That image is over 2 MB."]);
  const chunk = new Uint8Array(500_000);
  const endless = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(chunk) }); // no content-length
  expect(await refused(await put(endless))).toEqual([400, "That image is over 2 MB."]);
});
