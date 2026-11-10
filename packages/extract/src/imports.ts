import type { ImportSource } from "@pluck/shared-schemas";
import { unzipSync, strFromU8 } from "fflate";
import { parseHTML } from "linkedom";

// Parsers for the files people bring from elsewhere. Pure: a file in, a list of entries out.
export type { ImportSource };
export type ImportEntry = {
  url: string;
  title: string | null;
  tags: string[];
  note: string | null;
  createdAt: Date | null;
  html: (() => string) | null; // reads the kept page, when the export has it (Omnivore)
};

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endField();
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) {
    endField();
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((f) => f.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().replace(/^﻿/, "").toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const date = (v: string | number | null | undefined): Date | null => {
  if (!v) return null;
  const n = Number(v);
  const d = Number.isFinite(n) && n > 0 ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const tagList = (v: string | undefined, sep: RegExp) => (v ? v.split(sep).map((t) => t.trim()).filter(Boolean) : []);

// Pocket: title,url,time_added,tags,status  (tags joined with |)
function pocket(text: string): ImportEntry[] {
  return parseCsv(text).map((r) => ({
    url: r.url ?? "", title: r.title || null, tags: tagList(r.tags, /\|/), note: null, createdAt: date(r.time_added), html: null,
  }));
}

// Raindrop: id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite  (tags joined with ", ")
function raindrop(text: string): ImportEntry[] {
  return parseCsv(text).map((r) => ({
    url: r.url ?? "", title: r.title || null, tags: tagList(r.tags, /,\s*/), note: r.note || null, createdAt: date(r.created), html: null,
  }));
}

// Instapaper: URL,Title,Selection,Folder,Timestamp and, since late 2025, Tags (a JSON array in one cell). A folder
// becomes a tag; Unread, Archive and Starred say where it sat, and that and the star are dropped.
function instapaper(text: string): ImportEntry[] {
  const jsonTags = (v: string | undefined): string[] => {
    try {
      const list: unknown = JSON.parse(v || "[]");
      return Array.isArray(list) ? list.filter((t) => typeof t === "string") : [];
    } catch {
      return [];
    }
  };
  return parseCsv(text).map((r) => ({
    url: r.url ?? "", title: r.title || null, note: r.selection || null, createdAt: date(r.timestamp), html: null,
    tags: [...(r.folder && !/^(unread|archive|starred)$/i.test(r.folder) ? [r.folder] : []), ...jsonTags(r.tags)],
  }));
}

// Netscape bookmark HTML, as every browser exports it. A real HTML parser, so every entity (Chrome writes &#39;) decodes once.
function bookmarksHtml(text: string): ImportEntry[] {
  const { document } = parseHTML(text);
  return [...document.querySelectorAll("a")].flatMap((a) => {
    const attrs = Object.fromEntries([...a.attributes].map((x) => [x.name.toLowerCase(), x.value])); // HREF or href, as exported
    return attrs.href
      ? [{ url: attrs.href, title: a.textContent?.trim() || null, tags: tagList(attrs.tags, /,/), note: null, createdAt: date(attrs.add_date), html: null }]
      : [];
  });
}

// fflate unpacks each file into a buffer of the size the zip claims and never grows it, so checking that size
// before unpacking is what stops a zip bomb.
const MAX_ZIP_ENTRY = 20_000_000;
const MAX_ZIP_METADATA = 100_000_000;

// Omnivore: a zip of metadata_*.json arrays, with the kept page at content/<slug>.html when present.
function omnivore(zip: Uint8Array): ImportEntry[] {
  // Unzip only the metadata; note where each kept page is. The import runs in batches and parses the file
  // each time, so a page is decompressed only when its batch asks for it.
  const pages = new Map<string, string>(); // slug → file name
  let total = 0;
  const files = unzipSync(zip, {
    filter: (f) => {
      const slug = f.name.match(/(?:^|\/)content\/(.+)\.html$/)?.[1];
      if (slug && f.originalSize <= MAX_ZIP_ENTRY) pages.set(slug, f.name); // a bigger page is fetched instead
      if (!/(^|\/)metadata_[^/]*\.json$/.test(f.name)) return false;
      if (f.originalSize > MAX_ZIP_ENTRY || (total += f.originalSize) > MAX_ZIP_METADATA) throw new Error("the zip unpacks too large");
      return true;
    },
  });
  const read = (name: string) => () => strFromU8(unzipSync(zip, { filter: (f) => f.name === name })[name]!);
  const out: ImportEntry[] = [];
  for (const data of Object.values(files)) {
    const records = JSON.parse(strFromU8(data)) as { url?: string; title?: string; slug?: string; labels?: string[]; savedAt?: string; description?: string }[];
    for (const r of records) {
      const page = r.slug ? pages.get(r.slug) : undefined;
      out.push({ url: r.url ?? "", title: r.title ?? null, tags: r.labels ?? [], note: null, createdAt: date(r.savedAt), html: page ? read(page) : null });
    }
  }
  return out;
}

const text = (parse: (text: string) => ImportEntry[]) => (file: Uint8Array) => parse(strFromU8(file));
const PARSERS: Record<ImportSource, (file: Uint8Array) => ImportEntry[]> = {
  pocket: text(pocket), raindrop: text(raindrop), instapaper: text(instapaper), omnivore,
  html: text(bookmarksHtml),
};

// Throws on a file that is not what the source writes; the import then says it could not be read.
export function parseImport(source: ImportSource, file: Uint8Array): ImportEntry[] {
  return PARSERS[source](file).filter((e) => /^https?:\/\//i.test(e.url));
}
