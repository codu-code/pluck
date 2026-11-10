import * as blob from "@pluck/blob";
import { pendingJobCount } from "@pluck/db";
import { makeJobsVisible, twoUsers } from "@pluck/db/testing";
import { expect, test, vi } from "vitest";
import { runQueue } from "../job-runner";
import { beginImport, importStatus, runImport, startImport } from "./index";

vi.mock("@pluck/blob", async (real) => {
  const actual = await real<typeof import("@pluck/blob")>();
  return { ...actual, getObject: vi.fn(actual.getObject) };
});

const CSV = "url,title\nhttps://example.com/one,One\nhttps://example.com/two,Two\n";
async function uploaded(userId: string, source: "pocket" | "omnivore", body: string) {
  const begin = await beginImport(userId, source, body.length);
  expect((await fetch(begin.uploadUrl, { method: "PUT", headers: { "content-type": begin.contentType }, body })).ok).toBe(true);
  await startImport(userId, begin.import.id);
  return begin.import.id;
}
const run = async () => {
  await makeJobsVisible();
  // The real runner, on the import queue only: the links' own fetches stay queued.
  await runQueue({ import: (p) => runImport(String(p.userId), String(p.importId)) }, { queue: "import" });
};

test("a storage hiccup reading the file does not fail the import: the job is tried again", async () => {
  const { a } = await twoUsers();
  const id = await uploaded(a, "pocket", CSV);
  vi.mocked(blob.getObject).mockRejectedValueOnce(new Error("socket hang up"));
  await run();
  expect(await importStatus(a, id)).toMatchObject({ state: "running", error: null, done: 0 });
  expect(await pendingJobCount("import")).toBe(1); // queued again, not given up on
  await run();
  expect(await importStatus(a, id)).toMatchObject({ state: "done", total: 2, done: 2 });
});
