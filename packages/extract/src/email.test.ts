import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseEmail } from "./email.ts";

const eml = (name: string, token = "abc123xyz") => Buffer.from(readFileSync(join(import.meta.dirname, "../fixtures/email", `${name}.eml.tmpl`), "utf8").replace(/TOKEN/g, token));

test("a newsletter: alias, sender, subject, the body as reader text without the footer", async () => {
  const m = await parseEmail(eml("newsletter"));
  expect(m.aliasTokens).toEqual(["abc123xyz"]);
  expect(m.from).toEqual({ name: "Field Notes Weekly", address: "hello@fieldnotes.example" });
  expect(m.subject).toBe("Writing for engineers who skim");
  expect(m.messageId).toBe("<issue-42@fieldnotes.example>");
  expect(m.spam).toBe(false);
  expect(m.markdown).toContain("Short paragraphs are a kindness.");
  expect(m.wordCount).toBeGreaterThan(60);
});

test("a plain forwarded email keeps its text; spam verdicts are flagged", async () => {
  const fwd = await parseEmail(eml("forwarded"));
  expect(fwd.markdown).toContain("Measure the worktop cut-out twice");
  expect(fwd.subject).toBe("Fwd: the kitchen plan");
  expect((await parseEmail(eml("spam"))).spam).toBe(true);
  expect((await parseEmail(Buffer.from("To: someone@example.com\nSubject: x\n\nhi"))).aliasTokens).toEqual([]);
});
