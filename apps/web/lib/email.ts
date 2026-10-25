import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";

// `from` overrides EMAIL_FROM (the welcome, the Monday email). Automated mail goes from subdomains with no mailbox,
// so replies go to EMAIL_REPLY_TO unless the email names its own, or says null (sign-in links: no reply).
export type Email = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string>; from?: string; replyTo?: string | null };

// The email seam: SMTP (Mailpit locally, or a self-hoster's relay) when SMTP_URL is set, SES otherwise.
export async function sendEmail(email: Email): Promise<void> {
  // The App Review account has no mailbox anyone reads: its welcome and Monday email would only bounce.
  if (process.env.REVIEW_EMAIL && email.to.toLowerCase() === process.env.REVIEW_EMAIL.trim().toLowerCase()) return;
  const from = email.from ?? process.env.EMAIL_FROM ?? "Pluck <hello@getpluck.io>";
  const replyTo = email.replyTo === null ? undefined : (email.replyTo ?? process.env.EMAIL_REPLY_TO);
  if (process.env.SMTP_URL) {
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ ...email, from, replyTo });
    return;
  }
  await new SESv2Client({}).send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [email.to] },
      ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
      Content: {
        Simple: {
          Subject: { Data: email.subject },
          Body: { Text: { Data: email.text }, ...(email.html ? { Html: { Data: email.html } } : {}) },
          ...(email.headers ? { Headers: Object.entries(email.headers).map(([Name, Value]) => ({ Name, Value })) } : {}),
        },
      },
    }),
  );
}
