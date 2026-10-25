import { isTextKind, type Item } from "@pluck/shared-schemas";
import { useFormatter, useTranslations } from "use-intl";

type T = ReturnType<typeof useTranslations<"ios">>;
type F = ReturnType<typeof useFormatter>;

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const dayMonth = (f: F, d: Date, now: Date) =>
  f.dateTime(d, d.getFullYear() === now.getFullYear() ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });

// shared-schemas' when, dueLabel, rowSite and rowMeta (English only), said in the phone's language.
export function rowText(t: T, f: F, item: Item, now = new Date()) {
  const when = (() => {
    const d = new Date(item.createdAt);
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return t("row.when.now");
    if (diff < 3_600_000) return t("row.when.minutes", { count: Math.floor(diff / 60_000) });
    const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
    if (days === 0) return t("row.when.hours", { count: Math.floor(diff / 3_600_000) });
    if (days === 1) return t("row.when.yesterday");
    if (days < 7) return f.dateTime(d, { weekday: "short" });
    return dayMonth(f, d, now);
  })();
  const due = (iso: string) => {
    const d = new Date(iso);
    const days = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
    if (days < 0) return t("row.due.overdue");
    if (days === 0) return t("row.due.today");
    if (days === 1) return t("row.due.tomorrow");
    return t("row.due.on", { date: days < 7 ? f.dateTime(d, { weekday: "short" }) : f.dateTime(d, { day: "numeric", month: "short" }) });
  };
  const site = isTextKind(item.kind)
    ? t(`kinds.${item.kind}`)
    : item.siteName ?? (item.url ? new URL(item.url).hostname : item.source === "email" ? t("row.site.email") : t("row.site.file"));
  const meta = isTextKind(item.kind) ? (item.dueAt ? due(item.dueAt) : item.source === "mcp" ? t("row.meta.byAi") : t("row.meta.byYou"))
    : item.extraction.state === "failed" ? t("row.meta.failed")
      : item.extraction.state === "pending" ? t("row.meta.pending")
        : item.kind === "image" ? t("row.meta.photo")
          : item.kind === "video" ? t("row.meta.video")
            : item.wordCount ? t("row.meta.minutes", { count: Math.max(1, Math.round(item.wordCount / 230)) })
              : item.kind === "pdf" ? t("row.meta.pdf") : t("row.meta.link");
  return { when, site, meta, siteMeta: t("row.siteMeta", { site, meta }) };
}

export function useRowText() {
  const t = useTranslations("ios");
  const f = useFormatter();
  return (item: Item) => rowText(t, f, item);
}
