import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";

export type Email = { to: string; subject: string; text: string; html?: string };

// The email seam: SMTP (Mailpit locally, or a self-hoster's relay) when SMTP_URL is set, SES otherwise.
export async function sendEmail(email: Email): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "Pluck <hello@getpluck.io>";
  if (process.env.SMTP_URL) {
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ from, ...email });
    return;
  }
  await new SESv2Client({}).send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: { Data: email.subject },
          Body: { Text: { Data: email.text }, ...(email.html ? { Html: { Data: email.html } } : {}) },
        },
      },
    }),
  );
}
