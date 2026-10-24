import type { Digest } from "@pluck/shared-schemas";
import type { Email } from "./email";

// The Email board as a message: plain text is first-class, the HTML is the same words with a little layout.
// Copy rules: "to the Archive", "nothing is deleted", no exclamation marks.

const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const DAY_NAME = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

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

export function subjectFor(d: Digest): string {
  const n = d.expiring.length || d.oldest.length;
  return n ? `${NUMBERS[Math.min(n, 10)]} thing${n === 1 ? "" : "s"} you plucked and forgot.` : "Your week in Pluck.";
}

export function digestEmail(to: string, name: string, d: Digest, links: DigestLinks, now = new Date()): Email {
  const first = name.trim().split(/\s+/)[0];
  const greeting = `Morning${first ? ` ${first}` : ""}. Three minutes, then get on with your week.`;
  const moves = d.expiring[0] ? DAY_NAME.format(new Date(d.expiring[0].movesOn)) : "";
  const due = (iso: string) => {
    const days = (new Date(iso).getTime() - now.getTime()) / 86_400_000;
    return days < 6 ? WEEKDAY.format(new Date(iso)) : SHORT.format(new Date(iso));
  };

  const text: string[] = [greeting, ""];
  if (d.expiring.length) {
    text.push(`UNTOUCHED FOR ${d.expiryDays} DAYS`);
    for (const e of d.expiring) text.push(`- ${e.title} (${e.site})`, `  Keep: ${links.keep(e.id)}`, `  Let it go: ${links.letGo(e.id)}`);
    text.push(`Do nothing and they move to your Archive on ${moves}. Still searchable, never deleted.`, "");
  }
  if (d.due.length) {
    text.push("DUE THIS WEEK");
    for (const x of d.due) text.push(`- ${x.title}, ${due(x.dueAt)}`);
    text.push("");
  }
  if (d.oldest.length) {
    text.push("OLDEST IN YOUR INBOX");
    d.oldest.forEach((o, i) => text.push(`${i + 1}. ${o.title} ${links.open(o.id)}`));
    text.push("");
  }
  if (d.quietLists.length) {
    text.push("LISTS GONE QUIET");
    for (const l of d.quietLists) text.push(`- ${l.name}, ${l.tickedCount} of ${l.itemCount} ticked, ${l.idleDays} days ${links.list(l.id)}`);
    text.push("");
  }
  text.push(
    `Pile too big? Archive everything older than ${d.expiryDays ?? 30} days in one go: ${links.archiveAll}`,
    "",
    "Rather do this with your AI? Say \"run my weekly review\". Same list, one decision at a time.",
    "",
    `Links work for 7 days, no login. Plain rules, no model. Change the day: ${links.settings} . Stop these: ${links.stop}`,
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
        `Untouched for ${d.expiryDays} days`,
        d.expiring
          .map((e) => row(`<b style="font-weight:600">${esc(e.title)}</b><br><span style="color:#525A4E;font-size:13px">${esc(e.site)}</span>`, `${a(links.keep(e.id), "Keep")}&nbsp;&nbsp;&nbsp;${a(links.letGo(e.id), "Let it go", true)}`))
          .join("") + `<div style="color:#525A4E;font-size:13px;padding-top:10px">Do nothing and they move to your Archive on ${esc(moves)}. Still searchable, never deleted.</div>`,
      ),
    );
  if (d.due.length) parts.push(section("Due this week", d.due.map((x) => row(`<b style="font-weight:600">${esc(x.title)}</b>`, `<span style="color:#525A4E">${esc(due(x.dueAt))}</span>`)).join("")));
  if (d.oldest.length)
    parts.push(section("Oldest in your inbox", `<ol style="margin:0;padding-left:20px">${d.oldest.map((o) => `<li style="padding:3px 0">${a(links.open(o.id), o.title)}</li>`).join("")}</ol>`));
  if (d.quietLists.length)
    parts.push(
      section(
        "Lists gone quiet",
        d.quietLists.map((l) => row(`${a(links.list(l.id), l.name)} <span style="color:#525A4E">· ${l.tickedCount} of ${l.itemCount} ticked</span>`, `<span style="color:#525A4E">${l.idleDays} days</span>`)).join(""),
      ),
    );

  const html = `<!doctype html><html><body style="margin:0;background:#E4E8E0;padding:24px 8px;font-family:Geist,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:22px;color:#151A13">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:12px"><tr><td style="padding:40px 44px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 28px;font-size:22px;font-weight:700;color:#1E5C45;letter-spacing:-0.01em">pluck</td></tr>
<tr><td style="padding:0 0 28px;font-size:17px;line-height:26px">${esc(greeting)}</td></tr>
${parts.join("\n")}
<tr><td style="padding:0 0 16px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DDE2D8;border-radius:10px"><tr><td style="padding:14px 16px"><b style="font-weight:600">Pile too big?</b> <span style="color:#525A4E">Archive everything older than ${d.expiryDays ?? 30} days in one go.</span></td><td align="right" style="padding:14px 16px;white-space:nowrap">${a(links.archiveAll, "Archive it all. No, really.")}</td></tr></table></td></tr>
<tr><td style="padding:16px;background:#EDF0EA;border-radius:10px"><b style="font-weight:600">Rather do this with your AI?</b><br><span style="color:#394034">Say “run my weekly review”. Same list, one decision at a time.</span><br><span style="color:#525A4E;font-size:12px;line-height:18px">Links work for 7 days, no login. Plain rules, no model. ${a(links.settings, "Change the day", true)} · ${a(links.stop, "Stop these", true)}</span></td></tr>
</table></td></tr></table></td></tr></table></body></html>`;

  return {
    to,
    subject: subjectFor(d),
    text: `${text.join("\n")}\n`,
    html,
    // One-click unsubscribe (RFC 8058): mail clients POST to the same signed link.
    headers: { "List-Unsubscribe": `<${links.stop}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
