import type { Email } from "./email";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function magicLinkEmail(to: string, url: string): Email {
  return {
    to,
    replyTo: null, // sent from no-reply: a reply has no one to reach
    subject: "Your Pluck sign-in link",
    text: `Here is your link to sign in to Pluck. It works once, for the next 10 minutes.\n\n${url}\n\nIf you did not ask for this, ignore it. Nothing happens unless you open it and tap Sign in.\n`,
    html: `<div style="font-family: Geist, -apple-system, sans-serif; font-size: 15px; line-height: 22px; color: #151A13; max-width: 480px">
<p>Here is your link to sign in to Pluck. It works once, for the next 10 minutes.</p>
<p><a href="${escape(url)}" style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #1E5C45; color: #F6F8F4; text-decoration: none; font-weight: 500">Sign in to Pluck</a></p>
<p style="color: #525A4E; font-size: 13px; line-height: 19px">Button not working? Copy this link into your browser:<br><a href="${escape(url)}" style="color: #1E5C45; word-break: break-all">${escape(url)}</a></p>
<p style="color: #525A4E">If you did not ask for this, ignore it. Nothing happens unless you open it and tap Sign in.</p>
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

// The welcome, from a person. Plain text only (no HTML, images or tracking) and one link: from a young domain that
// is what a note from a person looks like, to readers and to spam filters. `plucked`: have they plucked anything yet.
export function welcomeEmail(to: string, o: { plucked: boolean; expiryDays: number | null; connectUrl: string }): Email {
  const paras = [
    "Hi,",
    "I'm Niall, and I make Pluck. Thanks for signing up. I wanted to say hello myself.",
    o.plucked
      ? "I can see you've plucked your first things already, so you know the main part: one tap from wherever you are, and Pluck keeps the page for you."
      : "The quickest way in is to pluck one thing you meant to read this week: paste its link at the top of your Inbox, and Pluck keeps the page for you.",
    `One thing most people find late: your AI can read everything you pluck. Connect Pluck to Claude, ChatGPT or Cursor in about thirty seconds, then ask it what you plucked this week: ${o.connectUrl}`,
    ...(o.expiryDays ? [`And if you go quiet for a while, nothing is lost. Items you have not touched in ${o.expiryDays} days move to the Archive, and nothing is deleted.`] : []),
    "Can I ask you one thing? Reply and tell me what made you try Pluck, or what you hoped it would do. It comes straight to me, and I read every reply.",
    "Niall",
  ];
  return { to, subject: "Thanks for trying Pluck", text: `${paras.join("\n\n")}\n` };
}
