import { describe, expect, it } from "vitest";
import { isMacAgent, shortcutKeys, shortcutText } from "./shortcut";

describe("the extension's shortcut, per device", () => {
  it("reads a Mac from its user agent, and not an iPhone", () => {
    expect(isMacAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36")).toBe(true);
    expect(isMacAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(false);
    expect(isMacAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0")).toBe(false);
    expect(isMacAgent(null)).toBe(false);
  });
  it("writes it the way Chrome does", () => {
    expect(shortcutText(true, "P")).toBe("⌥⇧P");
    expect(shortcutText(false, "H")).toBe("Alt+Shift+H");
    expect(shortcutKeys(true, "P")).toEqual(["⌥ Option", "⇧ Shift", "P"]);
  });
});
