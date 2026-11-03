import { describe, expect, it } from "vitest";
import { columnsFor } from "./layout";

// The breakpoints on the iPad-Spec board.
describe("columnsFor", () => {
  it("keeps the iPhone layout under 600 wide", () => {
    expect(columnsFor(440).wide).toBe(false); // iPhone 17 Pro Max
    expect(columnsFor(507).wide).toBe(false); // half a 13 in iPad in Split View
  });
  it("pins the sidebar in 13 in landscape, with a 380 list", () => {
    expect(columnsFor(1376)).toEqual({ wide: true, pinned: true, list: 380 });
  });
  it("hides the sidebar in 13 in portrait, with a 360 list", () => {
    expect(columnsFor(1032)).toEqual({ wide: true, pinned: false, list: 360 });
  });
  it("gives iPad mini portrait a 320 list", () => {
    expect(columnsFor(744)).toEqual({ wide: true, pinned: false, list: 320 });
  });
});
