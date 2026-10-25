import { expect, test } from "vitest";
import { funHandle, HANDLE } from "./handles.ts";

test("made-up handles are valid handles, at both ends of every word list", () => {
  for (const r of [0, 0.999999]) expect(funHandle(() => r)).toMatch(HANDLE);
  for (let i = 0; i < 2000; i++) expect(funHandle()).toMatch(HANDLE);
  expect(funHandle(() => 0)).toBe("plucky-otter-10");
});
