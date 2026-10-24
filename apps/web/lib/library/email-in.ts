import { deleteObject, getObject, keys, listKeys, moveObject } from "@pluck/blob";
import { aliasOf, claimOnce, createEmailItem, enqueue, hitRateLimit, regenerateAlias, setRawEmailKey, userForAlias } from "@pluck/db";
import { parseEmail } from "@pluck/extract";
import { log } from "../log";

// Email-in: SES drops each message into the bucket under inbound/. The scheduler queues one job per
// object; the job parses it, finds the person by the pluck+<token> address, and makes a Read item.

const INBOUND = "inbound/";
const MAX_BYTES = 10_000_000;
const PER_DAY = 200;
const domain = () => process.env.EMAIL_IN_DOMAIN ?? "in.getpluck.io";

export const emailInAddress = async (userId: string) => `pluck+${await aliasOf(userId)}@${domain()}`;
export const newEmailInAddress = async (userId: string) => `pluck+${await regenerateAlias(userId)}@${domain()}`;

export async function pollInbound(): Promise<number> {
  let queued = 0;
  // Wide enough that a few messages stuck in retry cannot fill the page and hold everyone else's back.
  for (const { key } of await listKeys(INBOUND, 500)) {
    if (key.endsWith("AMAZON_SES_SETUP_NOTIFICATION")) {
      await deleteObject(key);
      continue;
    }
    if (await claimOnce(`inbound:${key}`)) {
      await enqueue("email-in", { key });
      queued++;
    }
  }
  return queued;
}

export async function ingestInbound(key: string): Promise<"created" | "duplicate" | "dropped"> {
  const raw = await getObject(key);
  const drop = async (why: string) => {
    log("warn", "email-in dropped", { key, why });
    await deleteObject(key);
    return "dropped" as const;
  };
  if (raw.length > MAX_BYTES) return drop("too large");
  const mail = await parseEmail(raw).catch(() => null);
  if (!mail) return drop("unreadable"); // retrying will not make it parse
  if (mail.spam) return drop("spam or virus verdict");
  let userId: string | null = null;
  for (const t of mail.aliasTokens) if ((userId = await userForAlias(t))) break;
  if (!userId) return drop("no active address");
  if (!(await hitRateLimit(`email-in:${userId}`, PER_DAY, 86_400)).ok) return drop("daily limit");

  const { item, created } = await createEmailItem(userId, {
    subject: mail.subject, fromName: mail.from.name, fromAddress: mail.from.address, messageId: mail.messageId,
    markdown: mail.markdown, excerpt: mail.excerpt, wordCount: mail.wordCount,
  });
  if (!created) {
    await deleteObject(key);
    return "duplicate";
  }
  // The raw message stays with the item, like a kept page.
  const kept = keys.file(userId, item.id, "eml");
  await moveObject(key, kept);
  await setRawEmailKey(userId, item.id, kept);
  log("info", "email-in", { userId, itemId: item.id });
  return "created";
}
