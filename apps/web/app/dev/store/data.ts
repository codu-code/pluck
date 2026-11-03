import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LOCALE_NAMES, LOCALES, type Locale } from "@pluck/i18n";

// The store preview's data: docs/store as it is uploaded to App Store Connect (docs/store/app-store.md).
export const storeRoot = (): string => {
  for (let dir = process.cwd(); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "docs/store/en.json"))) return join(dir, "docs/store");
  }
  throw new Error("docs/store not found above the working directory");
};

// App Store Connect's limits for each field. Keywords count bytes, the rest characters.
export const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, description: 4000, keywords: 100 } as const;
type Field = keyof typeof LIMITS;

export type Flag = { field: Field | "ipad" | "iphone"; rule: string; text: string };

// voice.md: no exclamation marks or emoji, ever, in any language. The words we cut are English, and keywords are
// search terms nobody reads, so they are not checked.
const EVERYWHERE: [string, RegExp][] = [
  ["exclamation mark", /[!¡！]/u],
  ["emoji", /\p{Extended_Pictographic}/u],
  ["em dash", /—/u],
];
const ENGLISH: [string, RegExp][] = [
  ["a word we cut", /\b(seamless(ly)?|effortless(ly)?|leverag\w*|utili[sz]\w*|streamlin\w*|robust|best-in-class|powerful|unlock\w*|supercharg\w*|elevat\w*|empower\w*|enables? you|helps? you to)\b/i],
  ["a word we never use", /\b(saved?|saving|bookmark\w*|clip(ped|s)?|collection|board|folder|smart|magic(al)?|AI-powered|read-it-later queue|backlog|purge|expires?)\b/i],
  ["an AI tell", /\b(delve|game[- ]changer|revolutioni[sz]\w*|in today's|whether you're|look no further|unleash|elevate your|take .* to the next level|it's not just .* it's)\b/i],
];

export type Listing = { name: string; subtitle: string; promotionalText: string; description: string; keywords: string };
export type Store = {
  locale: Locale;
  label: string;
  listing: Listing;
  iphone: string[]; // paths under docs/store, in upload order
  ipad: string[];
  ipadCaptions: { title: string; subtitle: string }[];
  flags: Flag[];
};

const files = (root: string, dir: string, only?: number) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir)).filter((f) => /^\d+\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b))
      .filter((f) => !only || parseInt(f) <= only).map((f) => `${dir}/${f}`)
    : [];

export function load(locale: Locale): Store {
  const root = storeRoot();
  const listing = (JSON.parse(readFileSync(join(root, `${locale}.json`), "utf8")) as { appStore: Listing }).appStore;
  const strings = join(root, `ipad/strings.${locale}.json`);
  const ipadCaptions = existsSync(strings) ? (JSON.parse(readFileSync(strings, "utf8")) as { ipadScreenshots: Store["ipadCaptions"] }).ipadScreenshots : [];
  // English: the 6.9 in iPhone set and frames 1 to 5 of the iPad set (6 and 7 are drawn, and not uploaded).
  const iphone = locale === "en" ? files(root, "screenshots/6.9in") : files(root, `screenshots/${locale}`);
  const ipad = locale === "en" ? files(root, "ipad/with-text", 5) : files(root, `ipad/${locale}`);

  const flags: Flag[] = [];
  const check = (field: Flag["field"], text: string, rules: [string, RegExp][]) => {
    for (const [rule, re] of rules) {
      const m = text.match(re);
      if (m) flags.push({ field, rule, text: around(text, m.index ?? 0, m[0].length) });
    }
  };
  for (const field of ["name", "subtitle", "promotionalText", "description"] as const) {
    check(field, listing[field] ?? "", EVERYWHERE);
    if (locale === "en") check(field, listing[field] ?? "", ENGLISH);
  }
  for (const c of ipadCaptions) {
    check("ipad", `${c.title} ${c.subtitle}`, EVERYWHERE);
    if (locale === "en") check("ipad", `${c.title} ${c.subtitle}`, ENGLISH);
  }
  return { locale, label: LOCALE_NAMES[locale], listing, iphone, ipad, ipadCaptions, flags };
}

export const loadAll = (): Store[] => LOCALES.map(load);

export const length = (field: Field, text: string) => (field === "keywords" ? new TextEncoder().encode(text).length : [...text].length);

const around = (text: string, at: number, len: number) => {
  const start = Math.max(0, at - 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, at + len + 30).replace(/\s+/g, " ")}${at + len + 30 < text.length ? "…" : ""}`;
};

// What's still to do (docs/store/audit.json), for one language and device, plus what the page can tell by itself:
// a field over Apple's limit, a voice flag, a set shorter than English's.
export type Issue = { level: "review" | "polish"; title: string; detail: string; todo: string; frames: number[] };

export function issues(store: Store, device: "iphone" | "ipad", english: Store): Issue[] {
  const audit = JSON.parse(readFileSync(join(storeRoot(), "audit.json"), "utf8")) as { issues: (Issue & { device: string; locales: string[] })[] };
  const out: Issue[] = audit.issues
    .filter((i) => (i.device === device || i.device === "listing") && (i.locales.includes("*") || i.locales.includes(store.locale)))
    .map(({ level, title, detail, todo, frames }) => ({ level, title, detail, todo, frames }));
  for (const f of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const n = length(f, store.listing[f] ?? "");
    if (n > LIMITS[f]) out.push({ level: "review", title: `${f} is over Apple's limit`, detail: `${n} of ${LIMITS[f]}.`, todo: "Shorten it in App Store Connect, then here.", frames: [] });
  }
  if (store.flags.length) {
    out.push({ level: "polish", title: `${store.flags.length} line${store.flags.length > 1 ? "s" : ""} voice.md rules out`, detail: store.flags.map((f) => `${f.field}: ${f.rule}`).join("; "), todo: "Rewrite in Pluck's voice; the check panel quotes each one.", frames: [] });
  }
  const mine = device === "ipad" ? store.ipad.length : store.iphone.length;
  const theirs = device === "ipad" ? english.ipad.length : english.iphone.length;
  if (store.locale !== "en" && mine < theirs && !out.some((i) => i.title.startsWith("The older set"))) {
    out.push({ level: "polish", title: `${mine} screenshots where English has ${theirs}`, detail: "The set is shorter than English's.", todo: "Make the missing frames in this language.", frames: [] });
  }
  return out;
}
