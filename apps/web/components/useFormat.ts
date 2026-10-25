import { isTextKind, rowFact, type Item, type Source } from "@pluck/shared-schemas";
import { useFormatter, useTranslations } from "next-intl";

// What a row needs of an Item. Public and shared Lists have only these; the owner's views have the whole Item.
export type RowItem = Pick<Item, "id" | "kind" | "title" | "siteName" | "url" | "hasCover" | "excerpt" | "wordCount">
  & Partial<Pick<Item, "dueAt" | "source" | "extraction" | "createdAt" | "preview" | "facts">>;

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// The row words of @pluck/shared-schemas' format.ts (when, ago, due, site, meta, source), in the reader's language.
// Works in client and non-async server components. Dates use the runtime's time zone, as the day arithmetic does.
export function useFormat() {
  const t = useTranslations("app.format");
  const kind = useTranslations("app.kind");
  const format = useFormatter();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekday = (d: Date) => format.dateTime(d, { weekday: "short", timeZone });
  const date = (d: Date, now: Date) =>
    format.dateTime(d, { day: "numeric", month: "short", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }), timeZone });

  // How long ago, in the steps the Main board shows: now, minutes, hours, yesterday, a weekday, a date.
  function span(iso: string, now: Date): ["now" | "yesterday"] | ["minutes" | "hours", number] | ["date", string] {
    const d = new Date(iso);
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return ["now"];
    if (diff < 3_600_000) return ["minutes", Math.floor(diff / 60_000)];
    const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
    if (days === 0) return ["hours", Math.floor(diff / 3_600_000)];
    if (days === 1) return ["yesterday"];
    return ["date", days < 7 ? weekday(d) : date(d, now)];
  }

  // The "when" column: 2h, Yesterday, Tue, 3 Nov.
  function when(iso: string, now = new Date()): string {
    const [k, v] = span(iso, now);
    return k === "date" ? v : t(`when.${k}`, { n: v ?? 0 });
  }

  // "just now", "10 min ago", "yesterday", "on 3 Nov", for lines like "Plucked from iOS · 10 min ago".
  function ago(iso: string, now = new Date()): string {
    const [k, v] = span(iso, now);
    return k === "date" ? t("ago.on", { date: v }) : t(`ago.${k}`, { n: v ?? 0 });
  }

  // "due Fri" within the coming week, "due 3 Nov" after that.
  function due(iso: string, now = new Date()): string {
    const d = new Date(iso);
    const days = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
    if (days < 0) return t("due.overdue");
    if (days === 0) return t("due.today");
    if (days === 1) return t("due.tomorrow");
    return t("due.on", { date: days < 7 ? weekday(d) : date(d, now) });
  }

  // The row's "site" slot: the site for links, the kind for notes, todos and things.
  function site(item: RowItem): string {
    if (isTextKind(item.kind)) return kind(item.kind);
    return item.siteName ?? (item.url ? new URL(item.url).hostname : item.source === "email" ? t("site.email") : t("site.file"));
  }

  // "12 min", "photo", "Plucking", "Couldn't read", "by you", "due Fri". Null for a note on someone else's List.
  function meta(item: RowItem, now = new Date()): string | null {
    if (isTextKind(item.kind)) return item.dueAt ? due(item.dueAt, now) : !item.source ? null : item.source === "mcp" ? t("meta.byAi") : t("meta.byYou");
    if (item.extraction?.state === "failed") return t("meta.failed");
    if (item.extraction?.state === "pending") return t("meta.pending");
    if (item.kind === "image") return t("meta.photo");
    const fact = item.preview && item.facts ? rowFact({ preview: item.preview, facts: item.facts }) : null;
    if (fact) return said(fact);
    if (item.kind === "video") return t("meta.video");
    if (item.wordCount) return t("meta.minutes", { n: Math.max(1, Math.round(item.wordCount / 230)) });
    return item.kind === "pdf" ? t("meta.pdf") : t("meta.link");
  }

  // What a Preview's row says in place of the read time: "4 min", "@niall", "repo · TypeScript", "£24.99", "homepage".
  function said(f: NonNullable<ReturnType<typeof rowFact>>): string {
    switch (f.key) {
      case "length": return t("meta.minutes", { n: f.minutes });
      case "handle": return f.handle;
      case "post": return t("fact.post");
      case "code": return f.language ? t("fact.withLanguage", { what: t(`fact.code.${f.what}`), language: f.language }) : t(`fact.code.${f.what}`);
      case "price": return format.number(f.amount, { style: "currency", currency: f.currency });
      case "homepage": return t("fact.homepage");
      case "pages": return t("fact.pages", { count: f.count });
      case "app": return t(`fact.app.${f.app}`);
    }
  }

  const source = (s: Source) => t(`source.${s}`);
  return { when, ago, due, site, meta, source };
}
