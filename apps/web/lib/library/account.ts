import { TooLarge, deleteObject, deletePrefix, getObject, putObject, signedPutUrl, signedUrl } from "@pluck/blob";
import {
  aiClientName, aiConnections, claimOnce, countItems, createApiKey, disconnectAi, claimImportStart, createImport, deleteAccountData, enqueue, exportData, finishExport, getImport, getMe, hitRateLimit, importLink,
  latestExport, recountTags, listApiKeys, revokeApiKey, startExport, sweepTransfers, updateImport,
} from "@pluck/db";
import { parseImport, type ImportEntry, type ImportSource } from "@pluck/extract";
import { MAX_IMPORT_BYTES, cleanUrl, type AiConnection, type ApiKey, type ImportStatus } from "@pluck/shared-schemas";
import { Zip, ZipDeflate, strToU8 } from "fflate";
import { sendEmail } from "../email";
import { exportEmail, welcomeEmail } from "../emails";
import { ApiError } from "../errors";
import { log } from "../log";
import { ORIGIN } from "../origin";
import { track } from "../telemetry";
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
export async function newKey(userId: string, name: string, scopes?: string[]) {
  const made = await createApiKey(userId, name, scopes);
  track(userId, "api_key_created");
  return made;
}
export async function revokeKey(userId: string, id: string): Promise<void> {
  if (!(await revokeApiKey(userId, id))) throw new ApiError("not_found", "No such key.", 404);
}

// ---- AI tools connected over OAuth -------------------------------------------------------------------

export const aiToolsOf = (userId: string): Promise<AiConnection[]> => aiConnections(userId);
export async function disconnectAiTool(userId: string, clientId: string): Promise<void> {
  if (!(await disconnectAi(userId, clientId))) throw new ApiError("not_found", "That AI tool is not connected.", 404);
  trackAiTool(userId, "ai_tool_disconnected", clientId);
}

// Connected (the consent screen's yes, in lib/auth.ts) or disconnected, with the names of the tools still connected.
export function trackAiTool(userId: string, event: "ai_tool_connected" | "ai_tool_disconnected", clientId: string): void {
  track(userId, event, async () => ({ client_name: await aiClientName(clientId) }), {
    person: async () => ({ ai_tools: [...new Set((await aiConnections(userId)).map((c) => c.name))] }),
  });
}

// ---- Import ---------------------------------------------------------------------------------------

const BATCH = 200;
const TYPES: Record<ImportSource, string> = {
  pocket: "text/csv", raindrop: "text/csv", html: "text/html", omnivore: "application/zip",
  instapaper: "text/csv",
  readwise: "text/csv",
  wallabag: "application/json",
};

// Step 1: a record and a URL the browser uploads the file to directly. The URL takes exactly `size` bytes.
export async function beginImport(userId: string, source: ImportSource, size: number): Promise<{ import: ImportStatus; uploadUrl: string; contentType: string }> {
  const key = `u/${userId}/imports/${Date.now()}-${source}`;
  const record = await createImport(userId, source, key);
  return { import: record, uploadUrl: await signedPutUrl(key, TYPES[source], size), contentType: TYPES[source] };
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

// The job: 200 entries at a time for five seconds a run, until done (it re-queues itself, so a big file never hits
// a time limit). Omnivore's kept pages are read offline; the rest are fetched slowly by the extract queue.
export async function runImport(userId: string, importId: string): Promise<void> {
  const record = await getImport(userId, importId);
  if (!record || record.state !== "running") return;
  // Only a file that is too large or cannot be parsed is final. Anything else reading it (a storage hiccup) throws,
  // and the job is tried again.
  const file = await getObject(record.blobKey, { maxBytes: MAX_IMPORT_BYTES }).catch((e: unknown) => {
    if (e instanceof TooLarge) return null;
    throw e;
  });
  let entries: ImportEntry[] | null = null;
  try {
    if (file) entries = parseImport(record.source, new Uint8Array(file));
  } catch (e) {
    log("warn", "import unreadable", { userId, importId, error: String(e) });
  }
  if (!entries) {
    await updateImport(importId, { state: "failed", error: file ? "That file could not be read. Check it is the export from the right service." : "That file is over 500 MB." });
    return deleteObject(record.blobKey);
  }
  if (record.total === 0) await updateImport(importId, { total: entries.length });
  let { done, failed } = record;
  // shortcut: each run downloads and parses the file again, keep the parsed entries beside it if imports get slow.
  const until = Date.now() + 5000;
  while (done + failed < entries.length && Date.now() < until) {
    const touchedTags: string[] = [];
    for (const e of entries.slice(done + failed, done + failed + BATCH)) {
      const url = cleanUrl(e.url); // kept as the old app had it; importLink dedupes on its key
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
    await updateImport(importId, { done, failed });
  }
  const finished = done + failed >= entries.length;
  if (!finished) return void (await enqueue("import", { userId, importId }));
  await updateImport(importId, { state: "done" });
  track(userId, "import_finished", { import_source: record.source, total: entries.length, failed });
  await deleteObject(record.blobKey); // the file has done its job; if this fails the daily sweep takes it
}

// Daily (lib/schedule.ts): the files and records of imports that are over or were never started, and of exports
// whose emailed link has run out.
export async function sweepTransfersNow(now = new Date()): Promise<number> {
  const swept = await sweepTransfers(now, deleteObject);
  if (swept) log("info", "old imports and exports swept", { swept });
  return swept;
}

// ---- Export ---------------------------------------------------------------------------------------

// Five a day: each is a whole-library zip, a job and an email we pay for.
export async function requestExport(userId: string): Promise<{ id: string }> {
  const limit = await hitRateLimit(`export:${userId}`, 5, 86_400);
  if (!limit.ok) throw new ApiError("rate_limited", "That is five exports today. Try again tomorrow.", 429, { retryAfter: limit.retryAfter });
  const id = await startExport(userId);
  await enqueue("export", { userId, exportId: id });
  track(userId, "export_requested");
  return { id };
}

export async function exportState(userId: string): Promise<{ state: string; url: string | null; createdAt: string } | null> {
  const e = await latestExport(userId);
  if (!e) return null;
  return { state: e.state, createdAt: e.createdAt, url: e.blobKey ? await signedUrl(e.blobKey, 3600) : null };
}


// The job: one zip with everything as JSON, a Markdown file per list and one for every item, emailed as a
// signed link that works for 7 days. Items are read a page at a time and go into the zip as they come, so what is
// held is one page and the compressed zip, never the whole library.
export async function runExport(userId: string, exportId: string): Promise<void> {
  const me = await getMe(userId);
  if (!me) return;
  const { items, ...rest } = await exportData(userId);
  const chunks: Uint8Array[] = [];
  const zip = new Zip((err, chunk) => {
    if (err) throw err;
    chunks.push(chunk);
  });
  const entry = (name: string) => {
    const file = new ZipDeflate(name, { level: 6 });
    zip.add(file);
    return file;
  };
  const add = (name: string, text: string) => entry(name).push(strToU8(text), true);
  // pluck.json, a piece at a time, reads exactly as JSON.stringify({ exportedAt, account, items, ...rest }, null, 2).
  const json = entry("pluck.json");
  json.push(strToU8(`${JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: me.email, handle: me.handle } }, null, 2).slice(0, -2)},\n  "items": [`));
  add("README.txt", "Your Pluck library. pluck.json has everything; lists/ and items/ are the same in Markdown.\n");
  const listed = new Set(rest.lists.flatMap((l) => l.items.map((r) => r.itemId)));
  const byId = new Map<string, { title: string; url: string | null }>(); // what the lists' files need, no more
  let count = 0;
  for await (const page of items) {
    for (const it of page) {
      json.push(strToU8(`${count++ ? "," : ""}\n    ${JSON.stringify(it, null, 2).replaceAll("\n", "\n    ")}`));
      const head = [`# ${it.title}`, "", it.url ? `${it.url}` : "", it.tags.length ? `Tags: ${it.tags.join(", ")}` : "", it.note ? `Note: ${it.note}` : ""].filter(Boolean);
      add(`items/${it.id}.md`, `${head.join("\n")}\n\n${it.text ?? ""}\n`);
      if (listed.has(it.id)) byId.set(it.id, { title: it.title, url: it.url });
    }
  }
  json.push(strToU8(`${count ? "\n  ]" : "]"},${JSON.stringify(rest, null, 2).slice(1)}`), true);
  for (const l of rest.lists) {
    const lines = [`# ${l.name}`, ...(l.purpose ? ["", l.purpose] : []), ""];
    l.items.forEach((r, i) => {
      const it = byId.get(r.itemId);
      if (!it) return;
      lines.push(`${i + 1}. ${r.ticked ? "[x] " : ""}${it.url ? `[${it.title}](${it.url})` : it.title}`);
      if (r.note) lines.push(`   ${r.note}`);
    });
    add(`lists/${l.slug}.md`, `${lines.join("\n")}\n`); // slugs are unique per person; names need not be
  }
  zip.end();
  const key = `u/${userId}/exports/${new Date().toISOString().slice(0, 10)}-${exportId}.zip`;
  // shortcut: the compressed zip is held in memory for one putObject, a multipart upload is the upgrade.
  await putObject(key, Buffer.concat(chunks), "application/zip");
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
