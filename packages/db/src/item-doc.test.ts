import { describe, expect, test } from "vitest";
import { misfit, statusFields } from "./item-doc.ts";

const TEXT = "Only notes, todos and things have text to edit.";
const LINK = "A link can be Read, Watch, PDF or Image.";
const NOTE = "This can be a Note, Todo or Thing.";
const DONE = "Done is for todos and things.";

describe("which changes fit an Item", () => {
  test.each([
    ["note", { text: "x" }, null],
    ["link", { text: "x" }, TEXT],
    ["link", { kind: "video" }, null],
    ["pdf", { kind: "note" }, LINK],
    ["note", { kind: "todo" }, null],
    ["thing", { kind: "image" }, NOTE],
    ["todo", { status: "done" }, null],
    ["thing", { status: "done" }, null],
    ["note", { status: "done" }, DONE],
    ["link", { status: "done" }, DONE],
    ["note", { kind: "todo", status: "done" }, null], // Done goes by the Kind the Item ends with
    ["todo", { kind: "note", status: "done" }, DONE],
    ["video", { kind: "todo", status: "done" }, LINK],
    ["link", { status: "archived" }, null],
    ["note", { status: "later" }, null],
  ] as const)("%s with %o", (kind, change, why) => {
    expect(misfit(kind, change)).toBe(why);
  });

  test("a status change stamps the time, and only the person's archive has the reason user", () => {
    const now = new Date();
    expect(statusFields("archived", now)).toEqual({ status: "archived", statusChangedAt: now, archivedReason: "user" });
    expect(statusFields("done", now)).toEqual({ status: "done", statusChangedAt: now, archivedReason: null });
  });
});
