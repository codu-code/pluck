// Writes the two catalogs that cannot read packages/i18n at runtime, from it:
// - the Chrome extension's _locales (the manifest's name, description and shortcuts in each language), and
// - the iPhone share extension's Localizable.xcstrings (Swift reads an Apple String Catalog).
// Usage: node scripts/i18n-sync.mjs           writes them
//        node scripts/i18n-sync.mjs --check   fails if they are out of date (the test runs this)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LOCALES = ["en", "es", "pt-BR", "fr", "de", "ja", "it", "nl", "ko", "zh-Hans"];
const CHROME = { "pt-BR": "pt_BR", "zh-Hans": "zh_CN" }; // Chrome's codes where they differ from ours
const read = (surface, locale) => JSON.parse(readFileSync(join(root, "packages/i18n/messages", surface, `${locale}.json`), "utf8"));

// Chrome: only the manifest section, one messages.json per language that has any of it.
export function chromeLocales() {
  const out = {};
  for (const locale of LOCALES) {
    const manifest = read("extension", locale).manifest ?? {};
    const entries = Object.entries(manifest);
    if (!entries.length) continue;
    out[`apps/extension/public/_locales/${CHROME[locale] ?? locale}/messages.json`] =
      `${JSON.stringify(Object.fromEntries(entries.map(([k, v]) => [k, { message: v }])), null, 2)}\n`;
  }
  return out;
}

// Swift has no ICU: {name} becomes %1$@ (numbered by its order in English, so a translation may move it), and
// plurals are not allowed in this catalog (the test says so).
export function toSwift(message, order) {
  return message.replace(/\{(\w+)\}/g, (_, name) => {
    const i = order.indexOf(name);
    if (i < 0) throw new Error(`{${name}} is not in the English message`);
    return `%${i + 1}$@`;
  });
}

export function shareCatalog() {
  const en = read("share", "en");
  const strings = {};
  for (const key of Object.keys(en).sort()) {
    if (typeof en[key] !== "string") throw new Error(`share.${key}: the share catalog is flat`);
    if (/\{\w+,\s*(plural|select)/.test(en[key])) throw new Error(`share.${key}: no plurals or selects in the share catalog`);
    const order = [...new Set([...en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
    const localizations = {};
    for (const locale of LOCALES) {
      const value = read("share", locale)[key];
      if (typeof value === "string") localizations[locale] = { stringUnit: { state: "translated", value: toSwift(value, order) } };
    }
    strings[key] = { extractionState: "manual", localizations };
  }
  return { "apps/ios/targets/share/Localizable.xcstrings": `${JSON.stringify({ sourceLanguage: "en", strings, version: "1.0" }, null, 2)}\n` };
}

export const generated = () => ({ ...chromeLocales(), ...shareCatalog() });

export function stale() {
  return Object.entries(generated())
    .filter(([path, body]) => !existsSync(join(root, path)) || readFileSync(join(root, path), "utf8") !== body)
    .map(([path]) => path);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const s = stale();
    if (s.length) {
      console.error(`Out of date, run node scripts/i18n-sync.mjs:\n${s.join("\n")}`);
      process.exit(1);
    }
  } else {
    for (const [path, body] of Object.entries(generated())) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
      console.log(`wrote ${path}`);
    }
  }
}
