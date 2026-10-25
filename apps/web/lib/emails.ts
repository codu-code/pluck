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

// A List shared with someone (See only). Their words are few and escaped: a name and a list name are all anyone controls.
export function sharedListEmail(to: string, from: { name: string | null; handle: string }, listName: string, url: string): Email {
  const who = from.name ? `${from.name} (@${from.handle})` : `@${from.handle}`;
  const name = listName.slice(0, 120);
  return {
    to,
    subject: `${from.name || `@${from.handle}`} shared a List with you: ${name}`,
    text: `${who} shared a List with you on Pluck: “${name}”.\n\nOpen it here. You sign in with your email, no password:\n${url}\n\nYou can see it; only they change it. Not expecting this? Ignore it, or leave the List once you open it.\n`,
    html: `<div style="font-family: Geist, -apple-system, sans-serif; font-size: 15px; line-height: 22px; color: #151A13; max-width: 480px">
<p>${escape(who)} shared a List with you on Pluck:</p>
<p style="font-size: 20px; line-height: 26px; font-weight: 600">${escape(name)}</p>
<p><a href="${escape(url)}" style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #1E5C45; color: #F6F8F4; text-decoration: none; font-weight: 500">Open the List</a></p>
<p style="color: #525A4E">You can see it; only they change it. You sign in with your email, no password. Not expecting this? Ignore it, or leave the List once you open it.</p>
</div>`,
  };
}
