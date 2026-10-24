import { simpleParser, type AddressObject } from "mailparser";
import { extractFromHtml } from "./extract.ts";

export type ParsedEmail = {
  aliasTokens: string[]; // pluck+<token>@ found in To, Cc and delivery headers
  from: { name: string | null; address: string | null };
  subject: string;
  messageId: string | null;
  spam: boolean; // SES verdicts said spam or virus
  markdown: string;
  excerpt: string | null;
  wordCount: number;
  sizeBytes: number;
};

const TOKEN = /pluck\+([a-z0-9]{6,32})@/gi;

// Turns a raw email (as SES stores it) into what an email-in item needs. Pure: no network, no writes.
export async function parseEmail(raw: Buffer): Promise<ParsedEmail> {
  const mail = await simpleParser(raw);
  const addresses = [mail.to, mail.cc]
    .flatMap((a) => (Array.isArray(a) ? a : a ? [a] : []))
    .flatMap((a: AddressObject) => a.value.map((v) => v.address ?? ""));
  const headerText = ["delivered-to", "x-original-to", "x-forwarded-to", "envelope-to"].map((h) => String(mail.headers.get(h) ?? "")).join(" ");
  const aliasTokens = [...new Set([...`${addresses.join(" ")} ${headerText}`.matchAll(TOKEN)].map((m) => m[1]!.toLowerCase()))];
  const verdict = (h: string) => String(mail.headers.get(h) ?? "").toUpperCase();
  const spam = verdict("x-ses-spam-verdict") === "FAIL" || verdict("x-ses-virus-verdict") === "FAIL";

  const from = mail.from?.value[0];
  const subject = mail.subject?.trim() || "An email you plucked";
  // Newsletters are mostly HTML: run them through the same reader extraction as pages.
  const html = typeof mail.html === "string" ? mail.html : null;
  const fromHtml = html ? await extractFromHtml(html, "https://email.pluck.invalid/") : null;
  const text = fromHtml && fromHtml.wordCount > 0 ? fromHtml.markdown : (mail.text ?? "").trim();
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

  return {
    aliasTokens,
    from: { name: from?.name?.trim() || null, address: from?.address ?? null },
    subject,
    messageId: mail.messageId ?? null,
    spam,
    markdown: text,
    excerpt: fromHtml?.excerpt ?? (text.replace(/\s+/g, " ").slice(0, 200) || null),
    wordCount: words,
    sizeBytes: raw.length,
  };
}
