import { readdirSync, readFileSync } from "node:fs";
import { LOCALES } from "@pluck/i18n";
import { expect, test } from "vitest";
import { localePath, siteAlternates, splitLocale } from "./siteUrls";

test("a site page gets its language's prefix; English and everything else keep their URL", () => {
  expect(localePath("de", "/")).toBe("/de");
  expect(localePath("de", "/connect")).toBe("/de/connect");
  expect(localePath("pt-BR", "/blog/pocket-is-gone")).toBe("/pt-br/blog/pocket-is-gone");
  expect(localePath("ja", "/privacy#cookies")).toBe("/ja/privacy#cookies");
  expect(localePath("de", "/#lists")).toBe("/de#lists");
  expect(localePath("en", "/connect")).toBe("/connect");
  for (const href of ["/signin", "/inbox", "/blog/x/y", "https://github.com/codu-code/pluck", "#bugs"]) expect(localePath("de", href)).toBe(href);
});

test("the prefix reads back to the language and the page", () => {
  expect(splitLocale("/zh-hans/blog")).toEqual({ locale: "zh-Hans", path: "/blog" });
  expect(splitLocale("/de")).toEqual({ locale: "de", path: "/" });
  expect(splitLocale("/connect")).toEqual({ locale: null, path: "/connect" });
  expect(splitLocale("/deutsch/connect")).toEqual({ locale: null, path: "/deutsch/connect" });
  for (const l of LOCALES) expect(splitLocale(localePath(l, "/support"))).toEqual({ locale: l === "en" ? null : l, path: "/support" });
});

test("hreflang names every language and English as the default", () => {
  const a = siteAlternates("fr", "/terms");
  expect(a.canonical).toBe("/fr/terms");
  expect(Object.keys(a.languages)).toEqual([...LOCALES, "x-default"]);
  expect(a.languages["x-default"]).toBe("/terms");
});

test("every post is in every language, with a title, a description and keywords", () => {
  const dir = new URL("../content/blog/", import.meta.url);
  const slugs = readdirSync(new URL("en/", dir));
  for (const l of LOCALES) {
    expect(readdirSync(new URL(`${l}/`, dir)).sort(), l).toEqual([...slugs].sort());
    for (const slug of slugs) {
      const head = readFileSync(new URL(`${l}/${slug}`, dir), "utf8").match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
      for (const key of ["title", "description", "keywords"]) expect(head, `${l}/${slug} ${key}`).toMatch(new RegExp(`^${key}: \\S`, "m"));
    }
  }
});
