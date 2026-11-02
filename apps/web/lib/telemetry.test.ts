import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { EVENTS, PERSON, usageMessage } from "./telemetry";

test("docs/analytics.md lists every event with exactly the properties it may carry", () => {
  const doc = readFileSync(new URL("../../../docs/analytics.md", import.meta.url), "utf8");
  const rows = Object.fromEntries(
    [...doc.matchAll(/^\| `([$\w]+)` \|([^|]*)\|/gm)].map(([, event, props]) => [event, [...props!.matchAll(/`(\w+)`/g)].map((m) => m[1])]),
  );
  expect(rows).toEqual(Object.fromEntries(Object.entries(EVENTS).map(([e, p]) => [e, [...p]])));
});

test("anything not on the lists is dropped before it leaves", () => {
  const m = usageMessage("u1", "plucked", { source: "web", kind: "read", url: "https://secret.example", title: "Secret" }, {
    person: { plucked_from_web: true, email: "a@b.c" },
    once: { via: "try", name: "Ann" },
  });
  expect(m).toEqual({
    distinctId: "u1", event: "plucked", timestamp: undefined, uuid: undefined,
    properties: { source: "web", kind: "read", $set: { plucked_from_web: true }, $set_once: { via: "try" } },
  });
  expect(PERSON).not.toContain("email");
});
