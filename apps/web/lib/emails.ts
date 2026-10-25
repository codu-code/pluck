import { formatLocale, type Locale, messagesFor } from "@pluck/i18n";
import { createTranslator } from "next-intl";
import type { Email } from "./email";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// Email copy lives in packages/i18n (the email catalog), in the language of the person it goes to.
export const emailT = (locale: Locale) => createTranslator({ locale: formatLocale(locale), messages: { email: messagesFor("email", locale) }, namespace: "email" });

export function magicLinkEmail(to: string, url: string, locale: Locale = "en"): Email {
  const t = emailT(locale);
  return {
    to,
    replyTo: null, // sent from no-reply: a reply has no one to reach
    subject: t("magicLink.subject"),
    text: `${t("magicLink.intro")}\n\n${url}\n\n${t("magicLink.ignore")}\n`,
    html: `<div lang="${locale}" style="font-family: Geist, -apple-system, sans-serif; font-size: 15px; line-height: 22px; color: #151A13; max-width: 480px">
<p>${escape(t("magicLink.intro"))}</p>
<p><a href="${escape(url)}" style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #1E5C45; color: #F6F8F4; text-decoration: none; font-weight: 500">${escape(t("magicLink.button"))}</a></p>
<p style="color: #525A4E; font-size: 13px; line-height: 19px">${escape(t("magicLink.copy"))}<br><a href="${escape(url)}" style="color: #1E5C45; word-break: break-all">${escape(url)}</a></p>
<p style="color: #525A4E">${escape(t("magicLink.ignore"))}</p>
</div>`,
  };
}

// A List shared with someone (See only). Their words are few and escaped: a name and a list name are all anyone controls.
// `listName` null: the List is gone; it still says who shared something.
export function sharedListEmail(to: string, from: { name: string | null; handle: string }, listName: string | null, url: string, locale: Locale = "en"): Email {
  const t = emailT(locale);
  const who = from.name ? `${from.name} (@${from.handle})` : `@${from.handle}`;
  const name = (listName ?? t("sharedList.untitled")).slice(0, 120);
  return {
    to,
    subject: t("sharedList.subject", { sharer: from.name || `@${from.handle}`, name }),
    text: `${t("sharedList.text.intro", { who, name })}\n\n${t("sharedList.text.open")}\n${url}\n\n${t("sharedList.text.footer")}\n`,
    html: `<div lang="${locale}" style="font-family: Geist, -apple-system, sans-serif; font-size: 15px; line-height: 22px; color: #151A13; max-width: 480px">
<p>${escape(t("sharedList.intro", { who }))}</p>
<p style="font-size: 20px; line-height: 26px; font-weight: 600">${escape(name)}</p>
<p><a href="${escape(url)}" style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #1E5C45; color: #F6F8F4; text-decoration: none; font-weight: 500">${escape(t("sharedList.button"))}</a></p>
<p style="color: #525A4E">${escape(t("sharedList.footer"))}</p>
</div>`,
  };
}

// The welcome, from a person. Plain text only (no HTML, images or tracking) and one link: from a young domain that
// is what a note from a person looks like, to readers and to spam filters. `plucked`: have they plucked anything yet.
export function welcomeEmail(to: string, o: { plucked: boolean; expiryDays: number | null; connectUrl: string }, locale: Locale = "en"): Email {
  const t = emailT(locale);
  const paras = [
    t("welcome.hi"),
    t("welcome.intro"),
    o.plucked ? t("welcome.plucked") : t("welcome.fresh"),
    t("welcome.connect", { url: o.connectUrl }),
    ...(o.expiryDays ? [t("welcome.expiry", { days: o.expiryDays })] : []),
    t("welcome.ask"),
    t("welcome.signature"),
  ];
  return { to, subject: t("welcome.subject"), text: `${paras.join("\n\n")}\n` };
}

// The export is ready: one signed link to the zip.
export function exportEmail(to: string, url: string, locale: Locale = "en"): Email {
  const t = emailT(locale);
  return { to, subject: t("export.subject"), text: `${t("export.intro")}\n\n${url}\n\n${t("export.note")}\n` };
}
