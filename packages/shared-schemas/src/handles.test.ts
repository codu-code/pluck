import { expect, test } from "vitest";
import { funHandle, HANDLE, handleMove } from "./handles.ts";

test("made-up handles are valid handles, at both ends of every word list", () => {
  for (const r of [0, 0.999999]) expect(funHandle(() => r)).toMatch(HANDLE);
  for (let i = 0; i < 2000; i++) expect(funHandle()).toMatch(HANDLE);
  expect(funHandle(() => 0)).toBe("plucky-otter-10");
});

test("the handle warning says when public links move, and when nothing changes", () => {
  expect(handleMove(0, "getpluck.io", "wren")).toMatch(/^No public Lists yet/);
  expect(handleMove(1, "getpluck.io", "wren")).toMatch(/^Your public List moves to getpluck.io\/@wren\//);
  expect(handleMove(3, "getpluck.io", "wren")).toMatch(/^Your 3 public Lists move .* stop working/);
});
