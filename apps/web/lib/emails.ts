import type { Email } from "./email";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function magicLinkEmail(to: string, url: string): Email {
  return {
    to,
    subject: "Your Pluck sign-in link",
    text: `Here is your link to sign in to Pluck. It works once, for the next 10 minutes.\n\n${url}\n\nIf you did not ask for this, ignore it. Nothing happens until the link is opened.\n`,
    html: `<div style="font-family: Geist, -apple-system, sans-serif; font-size: 15px; line-height: 22px; color: #151A13; max-width: 480px">
<p>Here is your link to sign in to Pluck. It works once, for the next 10 minutes.</p>
<p><a href="${escape(url)}" style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #1E5C45; color: #F6F8F4; text-decoration: none; font-weight: 500">Sign in to Pluck</a></p>
<p style="color: #525A4E">If you did not ask for this, ignore it. Nothing happens until the link is opened.</p>
</div>`,
  };
}
