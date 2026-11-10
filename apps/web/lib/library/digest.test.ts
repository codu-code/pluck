import { createTextItem, enqueue } from "@pluck/db";
import { jobState, makeJobsVisible, twoUsers } from "@pluck/db/testing";
import { expect, test, vi } from "vitest";
import { runJobs } from "../jobs";
import { sendDigest } from "./index";

// The email provider: a note of who was sent to, and a switch to make the next send fail.
const mail = vi.hoisted(() => ({ to: [] as string[], failNext: false }));
vi.mock("../email", () => ({
  sendEmail: async (e: { to: string }) => {
    if (mail.failNext) {
      mail.failNext = false;
      throw new Error("provider down");
    }
    mail.to.push(e.to);
  },
}));

test("the Monday email goes once per person and date, however often its job runs, and a send that failed is tried again", async () => {
  const { a, b } = await twoUsers();
  for (const u of [a, b]) await createTextItem(u, { kind: "note", text: "Something to say", source: "web" });
  const sentTo = (who: "a" | "b") => mail.to.filter((to) => to.startsWith(`${who}-`)).length;

  await enqueue("digest", { userId: a, localDate: "2026-11-02" });
  await enqueue("digest", { userId: a, localDate: "2026-11-02" }); // the job again, as when it died after the provider took the email
  await enqueue("digest", { userId: b, localDate: "2026-11-02" });
  await runJobs({ budgetMs: 10_000 });
  expect([sentTo("a"), sentTo("b")]).toEqual([1, 1]); // and one person's email never stands in for another's

  mail.failNext = true;
  const nextWeek = await enqueue("digest", { userId: a, localDate: "2026-11-09" });
  await runJobs({ budgetMs: 10_000 });
  expect(await jobState(nextWeek)).toEqual({ state: "queued", lastError: "provider down" });
  expect(sentTo("a")).toBe(1);
  await makeJobsVisible();
  await runJobs({ budgetMs: 10_000 });
  expect((await jobState(nextWeek))?.state).toBe("done");
  expect(sentTo("a")).toBe(2);

  expect(await sendDigest(a, { force: true })).toBe(true); // "send me one now" is never held back
  expect(sentTo("a")).toBe(3);
});
