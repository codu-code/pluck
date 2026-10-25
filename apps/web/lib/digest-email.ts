import { formatLocale } from "@pluck/i18n";
import type { Locale } from "@pluck/i18n";
import type { Digest } from "@pluck/shared-schemas";
import { createFormatter } from "next-intl";
import type { Email } from "./email";
import { emailT } from "./emails";

// The Email board as a message: plain text is first-class, the HTML is the same words with a little layout.
// Copy rules: "to the Archive", "nothing is deleted", no exclamation marks.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type DigestLinks = {
  keep: (itemId: string) => string;
  letGo: (itemId: string) => string;
  open: (itemId: string) => string;
  list: (listId: string) => string;
  archiveAll: string;
  settings: string;
  stop: string;
};

export function subjectFor(d: Digest, locale: Locale = "en"): string {
  const t = emailT(locale);
  const n = d.expiring.length || d.oldest.length;
  return n ? t("digest.subject", { count: Math.min(n, 10) }) : t("digest.subjectQuiet");
}

// In the recipient's language and timezone (their settings.locale and settings.timezone).
export function digestEmail(to: string, name: string, d: Digest, links: DigestLinks, now = new Date(), { locale = "en", timeZone = "UTC" }: { locale?: Locale; timeZone?: string } = {}): Email {
  const t = emailT(locale);
  const f = createFormatter({ locale: formatLocale(locale), timeZone });
  const first = name.trim().split(/\s+/)[0];
  const greeting = first ? t("digest.greeting", { name: first }) : t("digest.greetingNoName");
  const days = d.expiryDays ?? 0;
  const moves = d.expiring[0] ? f.dateTime(new Date(d.expiring[0].movesOn), { weekday: "long" }) : "";
  const due = (iso: string) => {
    const left = (new Date(iso).getTime() - now.getTime()) / 86_400_000;
    return f.dateTime(new Date(iso), left < 6 ? { weekday: "short" } : { day: "numeric", month: "short" });
  };
  const heading = (s: string) => s.toLocaleUpperCase(locale);

  const text: string[] = [greeting, ""];
  if (d.expiring.length) {
    text.push(heading(t("digest.expiring.heading", { days })));
    for (const e of d.expiring) text.push(`- ${e.title} (${e.site})`, `  ${t("digest.expiring.keepLink", { url: links.keep(e.id) })}`, `  ${t("digest.expiring.letGoLink", { url: links.letGo(e.id) })}`);
    text.push(t("digest.expiring.moves", { day: moves }), "");
  }
  if (d.due.length) {
    text.push(heading(t("digest.due.heading")));
    for (const x of d.due) text.push(`- ${t("digest.due.line", { title: x.title, when: due(x.dueAt) })}`);
    text.push("");
  }
  if (d.oldest.length) {
    text.push(heading(t("digest.oldest.heading")));
    d.oldest.forEach((o, i) => text.push(`${i + 1}. ${o.title} ${links.open(o.id)}`));
    text.push("");
  }
  if (d.quietLists.length) {
    text.push(heading(t("digest.quiet.heading")));
    for (const l of d.quietLists) text.push(`- ${t("digest.quiet.line", { name: l.name, ticked: l.tickedCount, total: l.itemCount, days: l.idleDays })} ${links.list(l.id)}`);
    text.push("");
  }
  text.push(
    t("digest.archive.text", { days: d.expiryDays ?? 30, url: links.archiveAll }),
    "",
    t("digest.ai.text"),
    "",
    t("digest.footer.text", { settings: links.settings, stop: links.stop }),
  );

  const section = (title: string, body: string) =>
    `<tr><td style="padding:0 0 28px"><div style="font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#525A4E;padding-bottom:10px">${esc(title)}</div>${body}</td></tr>`;
  const row = (left: string, right: string) =>
    `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #E6EBE2"><tr><td style="padding:10px 0">${left}</td><td align="right" style="padding:10px 0;white-space:nowrap">${right}</td></tr></table>`;
  const a = (href: string, label: string, muted = false) =>
    `<a href="${esc(href)}" style="color:${muted ? "#525A4E" : "#151A13"};font-weight:${muted ? 400 : 600};text-decoration:underline">${esc(label)}</a>`;

  const parts: string[] = [];
  if (d.expiring.length)
    parts.push(
      section(
        t("digest.expiring.heading", { days }),
        d.expiring
          .map((e) => row(`<b style="font-weight:600">${esc(e.title)}</b><br><span style="color:#525A4E;font-size:13px">${esc(e.site)}</span>`, `${a(links.keep(e.id), t("digest.expiring.keep"))}&nbsp;&nbsp;&nbsp;${a(links.letGo(e.id), t("digest.expiring.letGo"), true)}`))
          .join("") + `<div style="color:#525A4E;font-size:13px;padding-top:10px">${esc(t("digest.expiring.moves", { day: moves }))}</div>`,
      ),
    );
  if (d.due.length) parts.push(section(t("digest.due.heading"), d.due.map((x) => row(`<b style="font-weight:600">${esc(x.title)}</b>`, `<span style="color:#525A4E">${esc(due(x.dueAt))}</span>`)).join("")));
  if (d.oldest.length)
    parts.push(section(t("digest.oldest.heading"), `<ol style="margin:0;padding-left:20px">${d.oldest.map((o) => `<li style="padding:3px 0">${a(links.open(o.id), o.title)}</li>`).join("")}</ol>`));
  if (d.quietLists.length)
    parts.push(
      section(
        t("digest.quiet.heading"),
        d.quietLists
          .map((l) => row(`${a(links.list(l.id), l.name)} <span style="color:#525A4E">· ${esc(t("digest.quiet.ticked", { ticked: l.tickedCount, total: l.itemCount }))}</span>`, `<span style="color:#525A4E">${esc(t("digest.quiet.idle", { days: l.idleDays }))}</span>`))
          .join(""),
      ),
    );

  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;background:#E4E8E0;padding:24px 8px;font-family:Geist,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:22px;color:#151A13">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:12px"><tr><td style="padding:40px 44px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 28px;font-size:22px;font-weight:700;color:#1E5C45;letter-spacing:-0.01em">pluck</td></tr>
<tr><td style="padding:0 0 28px;font-size:17px;line-height:26px">${esc(greeting)}</td></tr>
${parts.join("\n")}
<tr><td style="padding:0 0 16px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DDE2D8;border-radius:10px"><tr><td style="padding:14px 16px"><b style="font-weight:600">${esc(t("digest.archive.title"))}</b> <span style="color:#525A4E">${esc(t("digest.archive.body", { days: d.expiryDays ?? 30 }))}</span></td><td align="right" style="padding:14px 16px;white-space:nowrap">${a(links.archiveAll, t("digest.archive.button"))}</td></tr></table></td></tr>
<tr><td style="padding:16px;background:#EDF0EA;border-radius:10px"><b style="font-weight:600">${esc(t("digest.ai.title"))}</b><br><span style="color:#394034">${esc(t("digest.ai.body"))}</span><br><span style="color:#525A4E;font-size:12px;line-height:18px">${esc(t("digest.footer.note"))} ${a(links.settings, t("digest.footer.changeDay"), true)} · ${a(links.stop, t("digest.footer.stop"), true)}</span></td></tr>
</table></td></tr></table></td></tr></table></body></html>`;

  return {
    to,
    subject: subjectFor(d, locale),
    text: `${text.join("\n")}\n`,
    html,
    // One-click unsubscribe (RFC 8058): mail clients POST to the same signed link.
    headers: { "List-Unsubscribe": `<${links.stop}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
