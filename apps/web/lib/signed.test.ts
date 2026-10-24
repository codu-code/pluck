import { expect, test } from "vitest";
import { signTap, verifyTap } from "./signed";

test("a signed link verifies, expires after its time, and refuses any change", () => {
  const t = signTap({ u: "u1", a: "keep", i: "i1" }, 1000, 0);
  expect(verifyTap(t, 500)).toMatchObject({ u: "u1", a: "keep", i: "i1" });
  expect(verifyTap(t, 1500)).toBeNull();
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "u2", a: "keep", i: "i1", e: 1000 })).toString("base64url");
  expect(verifyTap(`${forged}.${sig}`, 500)).toBeNull();
  expect(verifyTap(`${body}.x${sig!.slice(1)}`, 500)).toBeNull();
  expect(verifyTap("nonsense", 500)).toBeNull();
});
