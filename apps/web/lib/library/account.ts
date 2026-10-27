import { TooLarge, deleteObject, deletePrefix, getObject, putObject, signedPutUrl, signedUrl } from "@pluck/blob";
import {
  aiConnections, claimOnce, countItems, createApiKey, disconnectAi, claimImportStart, createImport, deleteAccountData, enqueue, exportData, finishExport, getImport, getMe, importLink,
  latestExport, recountTags, listApiKeys, revokeApiKey, startExport, updateImport,
} from "@pluck/db";
import { parseImport, type ImportSource } from "@pluck/extract";
import { MAX_IMPORT_BYTES, normalizeUrl, type AiConnection, type ApiKey, type ImportStatus } from "@pluck/shared-schemas";
import { strToU8, zipSync } from "fflate";
import { sendEmail } from "../email";
import { exportEmail, welcomeEmail } from "../emails";
import { ApiError } from "../errors";
import { log } from "../log";
import { ORIGIN } from "../origin";
import { keepImported } from "./keeping";

// ---- Welcome -------------------------------------------------------------------------------------

// A note from the person who makes Pluck, hosted only (WELCOME_FROM is unset when you self-host). It waits
// 27 minutes so it lands after a first look around and reads as a reply to it, not as an autoresponder.
export const WELCOME_DELAY_MS = 27 * 60_000;

export async function queueWelcome(userId: string): Promise<void> {
  if (process.env.WELCOME_FROM) await enqueue("welcome", { userId }, { delayMs: WELCOME_DELAY_MS });
}

export async function sendWelcome(userId: string): Promise<boolean> {
  const from = process.env.WELCOME_FROM;
  const me = from ? await getMe(userId) : null;
  // Claimed before sending: a second copy of a personal note reads worse than a lost one.
  if (!from || !me || !(await claimOnce(`welcome:${userId}`))) return false;
  const counts = await Promise.all((["inbox", "later", "archived", "done"] as const).map((s) => countItems(userId, s)));
  const connectUrl = `${ORIGIN}/connect`;
  await sendEmail({ ...welcomeEmail(me.email, { plucked: counts.some(Boolean), expiryDays: me.settings.expiryDays, connectUrl }, me.settings.locale ?? "en"), from, replyTo: from });
  return true;
}

// ---- API keys -------------------------------------------------------------------------------------

export const keysOf = (userId: string): Promise<ApiKey[]> => listApiKeys(userId);
export const newKey = (userId: string, name: string, scopes?: string[]) => createApiKey(userId, name, scopes);
export async function revokeKey(userId: string, id: string): Promise<void> {
  if (!(await revokeApiKey(userId, id))) throw new ApiError("not_found", "No such key.", 404);
}

// ---- AI tools connected over OAuth -------------------------------------------------------------------

export const aiToolsOf = (userId: string): Promise<AiConnection[]> => aiConnections(userId);
export async function disconnectAiTool(userId: string, clientId: string): Promise<void> {
  if (!(await disconnectAi(userId, clientId))) throw new ApiError("not_found", "That AI tool is not connected.", 404);
}

// ---- Import ---------------------------------------------------------------------------------------

const BATCH = 200;
const TYPES: Record<ImportSource, string> = { pocket: "text/csv", raindrop: "text/csv", html: "text/html", omnivore: "application/zip" };

// Step 1: a record and a URL the browser uploads the file to directly.
export async function beginImport(userId: string, source: ImportSource): Promise<{ import: ImportStatus; uploadUrl: string; contentType: string }> {
  const key = `u/${userId}/imports/${Date.now()}-${source}`;
  const record = await createImport(userId, source, key);
  return { import: record, uploadUrl: await signedPutUrl(key, TYPES[source]), contentType: TYPES[source] };
}

// Step 2: once uploaded, the worker takes it from here.
export async function startImport(userId: string, id: string): Promise<ImportStatus> {
  const record = await getImport(userId, id);
  if (!record) throw new ApiError("not_found", "No such import.", 404);
  if (await claimImportStart(userId, id)) await enqueue("import", { userId, importId: id });
  const { blobKey: _blob, ...status } = (await getImport(userId, id))!;
  return status;
}

export async function importStatus(userId: string, id: string): Promise<ImportStatus> {
  const record = await getImport(userId, id);
  if (!record) throw new ApiError("not_found", "No such import.", 404);
  const { blobKey: _blob, ...status } = record;
  return status;
}

// The job: parse once, then 200 entries per run until done (it re-queues itself, so a big file never hits
// a time limit). Omnivore's kept pages are read offline; the rest are fetched slowly by the extract queue.
export async function runImport(userId: string, importId: string): Promise<void> {
  const record = await getImport(userId, importId);
  if (!record || record.state !== "running") return;
  let entries;
  try {
    entries = parseImport(record.source, new Uint8Array(await getObject(record.blobKey, { maxBytes: MAX_IMPORT_BYTES })));
  } catch (e) {
    const tooLarge = e instanceof TooLarge;
    if (tooLarge) await deleteObject(record.blobKey);
    await updateImport(importId, {
      state: "failed",
      error: tooLarge ? "That file is over 500 MB." : "That file could not be read. Check it is the export from the right service.",
    });
    log("warn", "import unreadable", { userId, importId, error: String(e) });
    return;
  }
  if (record.total === 0) await updateImport(importId, { total: entries.length });
  let { done, failed } = record;
  const touchedTags: string[] = [];
  for (const e of entries.slice(done + failed, done + failed + BATCH)) {
    const url = normalizeUrl(e.url);
    if (!url) {
      failed++;
      continue;
    }
    const { item, created, tagIds } = await importLink(userId, url, e);
    touchedTags.push(...tagIds);
    // Spread the fetching out: a thousand imports should not hit the network at once.
    if (created) await keepImported(userId, item, { html: e.html, title: e.title, delayMs: (done % 1000) * 3000 });
    done++;
  }
  await recountTags(userId, touchedTags);
  const finished = done + failed >= entries.length;
  await updateImport(importId, { done, failed, state: finished ? "done" : "running" });
  if (!finished) await enqueue("import", { userId, importId });
}

// ---- Export ---------------------------------------------------------------------------------------

export async function requestExport(userId: string): Promise<{ id: string }> {
  const id = await startExport(userId);
  await enqueue("export", { userId, exportId: id });
  return { id };
}

export async function exportState(userId: string): Promise<{ state: string; url: string | null; createdAt: string } | null> {
  const e = await latestExport(userId);
  if (!e) return null;
  return { state: e.state, createdAt: e.createdAt, url: e.blobKey ? await signedUrl(e.blobKey, 3600) : null };
}


// The job: one zip with everything as JSON, a Markdown file per list and one for every item, emailed as a
// signed link that works for 7 days.
export async function runExport(userId: string, exportId: string): Promise<void> {
  const me = await getMe(userId);
  if (!me) return;
  const data = await exportData(userId);
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const files: Record<string, Uint8Array> = {
    "pluck.json": strToU8(JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: me.email, handle: me.handle }, ...data }, null, 2)),
    "README.txt": strToU8("Your Pluck library. pluck.json has everything; lists/ and items/ are the same in Markdown.\n"),
  };
  for (const l of data.lists) {
    const lines = [`# ${l.name}`, ...(l.purpose ? ["", l.purpose] : []), ""];
    l.items.forEach((r, i) => {
      const it = byId.get(r.itemId);
      if (!it) return;
      lines.push(`${i + 1}. ${r.ticked ? "[x] " : ""}${it.url ? `[${it.title}](${it.url})` : it.title}`);
      if (r.note) lines.push(`   ${r.note}`);
    });
    files[`lists/${l.slug}.md`] = strToU8(`${lines.join("\n")}\n`); // slugs are unique per person; names need not be
  }
  for (const it of data.items) {
    const head = [`# ${it.title}`, "", it.url ? `${it.url}` : "", it.tags.length ? `Tags: ${it.tags.join(", ")}` : "", it.note ? `Note: ${it.note}` : ""].filter(Boolean);
    files[`items/${it.id}.md`] = strToU8(`${head.join("\n")}\n\n${it.text ?? ""}\n`);
  }
  const key = `u/${userId}/exports/${new Date().toISOString().slice(0, 10)}-${exportId}.zip`;
  await putObject(key, Buffer.from(zipSync(files, { level: 6 })), "application/zip");
  await finishExport(exportId, key);
  const url = await signedUrl(key, 7 * 86_400);
  await sendEmail(exportEmail(me.email, url, me.settings.locale ?? "en"));
}

// ---- Delete account -------------------------------------------------------------------------------

// "Delete everything. No, really.": the person types their email to confirm. Items, text, files, lists,
// tags, keys and the account go now. Backups age out within 30 days (Privacy page).
export async function deleteAccount(userId: string, confirmEmail: string): Promise<void> {
  const me = await getMe(userId);
  if (!me) throw new ApiError("not_found", "No such account.", 404);
  if (confirmEmail.trim().toLowerCase() !== me.email.toLowerCase()) throw new ApiError("bad_request", "Type your email exactly to confirm.", 400);
  await deletePrefix(`u/${userId}/`); // files first: if this fails the account is still there to try again
  await deleteAccountData(userId);
  log("info", "account deleted", { userId });
}
