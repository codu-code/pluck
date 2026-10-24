import type { CaptureResult } from "posthog-js";
import { expect, test } from "vitest";
import { scrub } from "./analytics";

const event = (name: string, properties: Record<string, unknown> = {}) => ({ event: name, properties, uuid: "u" }) as unknown as CaptureResult;

test("without a yes, only errors leave the browser", () => {
  expect(scrub(event("$pageview"), null)).toBeNull();
  expect(scrub(event("$autocapture"), "no")).toBeNull();
  expect(scrub(event("$exception"), "no")?.event).toBe("$exception");
  expect(scrub(event("$pageview"), "yes")?.event).toBe("$pageview");
});

test("what anyone plucked never leaves: titles, queries and hashes are dropped, utm tags kept", () => {
  const out = scrub(event("$pageview", {
    title: "My secret item", $title: "My secret item",
    $current_url: "https://getpluck.io/search?q=divorce+lawyer#top",
    $referrer: "https://getpluck.io/?utm_source=newsletter&ref=x",
  }), "yes")!;
  expect(out.properties.title).toBeUndefined();
  expect(out.properties.$title).toBeUndefined();
  expect(out.properties.$current_url).toBe("https://getpluck.io/search");
  expect(out.properties.$referrer).toBe("https://getpluck.io/?utm_source=newsletter");
});
