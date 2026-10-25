import type { Item } from "@pluck/shared-schemas";
import { expect, test } from "vitest";
import { onWifi, overCap, plan, toKeep } from "./keep";

const at = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();
const item = (n: number, over: Partial<Item> = {}) =>
  ({ id: `i${n}`, kind: "link", createdAt: at(n), updatedAt: at(n), extraction: { state: "done", attempts: 1, lastError: null }, ...over }) as Item;

test("keeps the newest 300 Items with text, each once, across Inbox, Later and Lists", () => {
  const inbox = Array.from({ length: 250 }, (_, i) => item(i));
  const later = Array.from({ length: 100 }, (_, i) => item(1000 + i));
  const inLists = [item(5), item(1050)]; // already in Inbox or Later
  const keep = toKeep([...inbox, ...later, ...inLists]);
  expect(keep).toHaveLength(300);
  expect(new Set(keep.map((i) => i.id)).size).toBe(300);
  expect(keep[0]!.id).toBe("i1099"); // newest first
  expect(keep.at(-1)!.id).toBe("i50"); // the 50 oldest of 350 are let go
});

test("images, pages still being plucked and pages that could not be read are not kept; notes are", () => {
  const keep = toKeep([
    item(1, { kind: "image" }),
    item(2, { extraction: { state: "pending", attempts: 0, lastError: null } }),
    item(3, { extraction: { state: "failed", attempts: 3, lastError: "gone" } }),
    item(4, { kind: "note", extraction: { state: "none", attempts: 0, lastError: null } }),
    item(5, { kind: "pdf" }),
  ]);
  expect(keep.map((i) => i.id)).toEqual(["i5", "i4"]);
});

test("fetches only what is new or changed, and lets go of what fell out of the newest", () => {
  const keep = [item(3), item(2, { updatedAt: at(99) }), item(1)];
  const kept = { i1: { updatedAt: at(1), bytes: 10 }, i2: { updatedAt: at(2), bytes: 10 }, i0: { updatedAt: at(0), bytes: 10 } };
  const { fetch, drop } = plan(keep, kept);
  expect(fetch.map((i) => i.id)).toEqual(["i3", "i2"]);
  expect(drop).toEqual(["i0"]);
});

test("Wi-Fi only: never on mobile data or with no connection", () => {
  expect(onWifi({ type: "WIFI", isInternetReachable: true })).toBe(true);
  expect(onWifi({ type: "ETHERNET" })).toBe(true);
  expect(onWifi({ type: "CELLULAR", isInternetReachable: true })).toBe(false);
  expect(onWifi({ type: "WIFI", isInternetReachable: false })).toBe(false);
  expect(onWifi({ type: "NONE" })).toBe(false);
  expect(onWifi({})).toBe(false);
});

test("Items kept by hand stay, whatever their age or Kind, and are never let go by the newest", () => {
  const newest = Array.from({ length: 301 }, (_, i) => item(1000 + i));
  const old = item(1, { status: "archived" });
  const photo = item(2, { kind: "image" });
  const hand = new Set(["i1", "i2"]);
  const keep = toKeep([...newest, old, photo], hand);
  expect(keep.slice(0, 2).map((i) => i.id).sort()).toEqual(["i1", "i2"]);
  expect(keep).toHaveLength(302); // the 300 newest, and the two by hand
  expect(plan([], { i1: { updatedAt: at(1), bytes: 1 }, i9: { updatedAt: at(9), bytes: 1 } }, hand).drop).toEqual(["i9"]);
});

test("over the cap, the oldest automatic pictures go first, never a hand-kept one", () => {
  const kept = { a: { updatedAt: at(1), bytes: 10, media: 50 }, b: { updatedAt: at(2), bytes: 10, media: 50 }, c: { updatedAt: at(3), bytes: 10, media: 50 } };
  expect(overCap(["a", "b", "c"], kept, new Set(["c"]), 100)).toEqual(["b", "a"]); // c is the oldest, but kept by hand
  expect(overCap(["a", "b", "c"], kept, new Set(), 200)).toEqual([]);
});
