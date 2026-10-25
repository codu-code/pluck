import { messagesFor } from "@pluck/i18n";
import { claimJob, pendingJobCount } from "@pluck/db";
import { twoUsers } from "@pluck/db/testing";
import { afterEach, expect, test, vi } from "vitest";
import { exportEmail, sharedListEmail, welcomeEmail } from "./emails";
import { queueWelcome, sendWelcome, WELCOME_DELAY_MS } from "./library";

afterEach(() => vi.unstubAllEnvs());

test("the welcome is a plain note from a person and keeps the copy rules", () => {
  const fresh = welcomeEmail("a@example.test", { plucked: false, expiryDays: 30, connectUrl: "https://x/connect" });
  expect(fresh.subject).toBe("Thanks for trying Pluck");
  expect(fresh.html).toBeUndefined(); // plain text only
  expect(fresh.text.startsWith("Hi,\n\nI'm Niall, and I make Pluck.")).toBe(true);
  expect(fresh.text).toContain("paste its link at the top of your Inbox");
  expect(fresh.text).toContain("move to the Archive, and nothing is deleted.");
  expect(fresh.text.match(/https?:\/\//g)).toHaveLength(1); // one link, to Connect
  const going = welcomeEmail("a@example.test", { plucked: true, expiryDays: null, connectUrl: "https://x/connect" });
  expect(going.text).toContain("you've plucked your first things already");
  expect(going.text).not.toContain("Archive"); // expiry off: no promise about it
  for (const e of [fresh, going]) expect(`${e.subject}${e.text}`).not.toMatch(/!|saved|bookmark|collection|smart|magic/i);
});

// Fallback to English is tested in packages/i18n; here each email takes its words from the recipient's catalog.
test("each email is in the recipient's language", () => {
  const o = { plucked: false, expiryDays: 30, connectUrl: "https://x/connect" };
  expect(welcomeEmail("a@example.test", o, "ko").subject).toBe(messagesFor("email", "ko").welcome.subject);
  const from = { name: "Niall", handle: "niall" };
  const shared = sharedListEmail("b@example.test", from, null, "https://x/shared/1", "nl");
  expect(shared.html).toContain('lang="nl"');
  expect(shared.subject).toContain("Niall");
  expect(exportEmail("a@example.test", "https://x/zip", "fr").subject).toBe(messagesFor("email", "fr").export.subject);
});

test("the welcome is hosted only, waits 27 minutes and goes once", async () => {
  const { a } = await twoUsers();
  await queueWelcome(a); // self-host: no WELCOME_FROM, nothing queued
  expect(await pendingJobCount("welcome")).toBe(0);
  expect(await sendWelcome(a)).toBe(false);

  vi.stubEnv("WELCOME_FROM", "Niall at Pluck <niall@example.test>");
  await queueWelcome(a);
  expect(await pendingJobCount("welcome")).toBe(1);
  expect(await claimJob(60_000)).toBeNull(); // not visible yet
  expect(WELCOME_DELAY_MS).toBe(27 * 60_000);
  expect(await sendWelcome(a)).toBe(true);
  expect(await sendWelcome(a)).toBe(false); // a retry or a second sign-up never sends it twice
});
