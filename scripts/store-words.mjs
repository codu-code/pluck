// The words on the store boards' drawn screens (frame 1's share sheet, frames 6 and 7), English to one language:
// the recipe page from docs/store/frame1.json, the app's own words from packages/i18n's iOS catalog. The store
// scripts swap every text node that matches an English key.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const json = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const at = (o, path) => path.split(".").reduce((d, k) => d?.[k], o);

// shortcut: ICU here is only the plural and select shapes these keys use; upgrade to intl-messageformat if one grows.
const icu = (msg, vars) =>
  msg
    .replace(/\{(\w+), (?:plural|select),((?:[^{}]|\{[^{}]*\})*)\}/g, (_, name, cases) => {
      const branches = Object.fromEntries([...cases.matchAll(/(=?\w+) \{([^{}]*)\}/g)].map((m) => [m[1], m[2]]));
      const v = vars[name];
      const pick = branches[v] ?? branches[`=${v}`] ?? (v === 1 ? branches.one : undefined) ?? branches.other ?? "";
      return pick.replace(/#/g, String(v));
    })
    .replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

// English as the boards draw it → catalog key (and its values).
const KEYS = [
  ["Settings", "settings.title"], ["Done", "common.done"], ["Name", "settings.name"], ["Add your name", "settings.addName"],
  ["Handle", "settings.handle"], ["Sign out", "settings.signOut"], ["Your name and handle show on Lists you make public, and nowhere else.", "settings.accountFootnote"],
  ["Copy the connector address", "settings.copyConnector"], ["Disconnect", "settings.disconnect"],
  ["Add the address once in your AI tool. It works on every device you use it on.", "settings.toolsHint"],
  ["Copy the email-in address", "settings.copyEmailIn"], ["New address", "settings.newAddress"],
  ["Forward a newsletter here. It lands in the Inbox as a Read item.", "settings.emailInFootnote"],
  ["Move to the Archive after", "settings.moveAfter"], ["Applies to", "settings.appliesTo"], ["Inbox and Later", "settings.scopeInboxLater"],
  ["30 days", "settings.days", { count: 30 }], ["Copy", "common.copy"],
  ["Later", "actions.later"], ["Archive", "actions.archive"], ["Tags", "actions.tags"], ["Add to a List", "actions.addToList"],
  ["Open the original", "item.openOriginal"], ["Share", "actions.share"], ["Inbox", "tabs.inbox"], ["Lists", "tabs.lists"],
  ["Search", "tabs.search"], ["Paste and pluck", "ipad.keys.paste"], ["New Note", "ipad.add.new", { kind: "note" }],
  ["New Todo", "ipad.add.new", { kind: "todo" }], ["Show or hide sidebar", "ipad.keys.sidebar"], ["Next", "ipad.keys.next"],
  ["Previous", "ipad.keys.previous"],
];
// Section names, drawn as written in the iPad sidebar and in capitals over the iPhone's groups.
const SECTIONS = ["account", "aiTools", "emailIn", "expiry", "library", "appIcon", "privacy"];

export function words(lang) {
  const out = { ...(json("docs/store/frame1.json")[lang] ?? {}) };
  if (lang === "en") return out;
  const en = json("packages/i18n/messages/ios/en.json");
  const tr = json(`packages/i18n/messages/ios/${lang}.json`);
  for (const [english, key, vars = {}] of KEYS) {
    const msg = at(tr, key);
    if (typeof msg === "string" && !(english in out)) out[english] = icu(msg, vars);
  }
  for (const s of SECTIONS) {
    const e = at(en, `settings.sections.${s}`);
    const t = at(tr, `settings.sections.${s}`);
    if (e && t) Object.assign(out, { [e]: t, [e.toUpperCase()]: /^(ja|ko|zh)/.test(lang) ? t : t.toLocaleUpperCase(lang) });
  }
  // "Connected 3 Nov", as the app formats it.
  const date = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(new Date(2026, 10, 3));
  out["Connected 3 Nov"] = icu(at(tr, "settings.connected"), { date });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(words(process.argv[2] ?? "de"));
