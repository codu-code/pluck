import { beforeEach, expect, test, vi } from "vitest";

// The browser as the background sees it: storage.local, the alarms it has set and the toolbar badge.
const b = vi.hoisted(() => {
  const b = { local: {} as Record<string, unknown>, alarms: new Set<string>(), made: 0, badge: "" };
  Object.assign(globalThis, {
    __DEFAULT_SERVER__: "https://pluck.test",
    browser: {
      storage: { local: { get: async (k: string) => ({ [k]: b.local[k] }), set: async (patch: object) => void Object.assign(b.local, patch) } },
      alarms: { get: async (name: string) => (b.alarms.has(name) ? { name } : undefined), create: async (name: string) => void (b.alarms.add(name), b.made++) },
      action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async ({ text }: { text: string }) => void (b.badge = text) },
    },
  });
  return b;
});
import { resume } from "./pluck";

beforeEach(() => Object.assign(b, { local: {}, alarms: new Set(), made: 0, badge: "" }));

test("a pluck still waiting when the browser comes back gets its alarm and its dot again", async () => {
  b.local.queue = [{ id: "q1", body: { url: "https://a.test" }, at: 1 }];
  await resume(); // the browser restarted, or the extension updated: the alarm is gone
  expect([...b.alarms]).toEqual(["drain"]);
  expect(b.badge).toBe("•");
  await resume(); // the worker only went idle and woke: the alarm is still set, and keeps its minute
  expect(b.made).toBe(1);
});

test("with nothing waiting, starting sets no alarm and shows no dot", async () => {
  await resume();
  expect(b.made).toBe(0);
  expect(b.badge).toBe("");
});
