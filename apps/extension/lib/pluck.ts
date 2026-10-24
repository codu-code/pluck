import type { CreateItemBody, Item, PluckResponse } from "@pluck/shared-schemas";
import { api, Refused, Unreachable } from "./api";
import { capture, screenshot } from "./capture";
import { createQueue } from "@pluck/client";
import { get, set, settings } from "./store";

export type PluckOutcome =
  | { state: "plucked"; item: Item; created: boolean }
  | { state: "queued"; count: number }
  | { state: "refused"; message: string };

const isWeb = (url?: string) => Boolean(url && /^https?:\/\//.test(url));

// The one way in from the popup, the shortcut and the right-click menu.
export async function pluckTab(tab: { id?: number; url?: string; title?: string; windowId?: number }, { asHighlight = false } = {}): Promise<PluckOutcome> {
  if (!isWeb(tab.url)) return { state: "refused", message: "Nothing to pluck on this page." };
  const opts = await settings();
  const page = tab.id === undefined ? null : await capture(tab.id, { content: opts.sendContent, transcripts: opts.transcripts });
  const outcome = await send({
    url: tab.url!, source: "extension",
    ...(page?.title || tab.title ? { title: (page?.title || tab.title)!.slice(0, 500) } : {}),
    ...(page?.html ? { html: page.html } : {}),
    ...(page?.transcript ? { transcript: page.transcript } : {}),
    ...(asHighlight && page?.selection ? { selection: page.selection.slice(0, 20_000) } : {}),
  });
  if (outcome.state === "plucked") {
    if (opts.defaultKind !== "guess" && outcome.created && outcome.item.kind !== opts.defaultKind)
      outcome.item = (await api<{ item: Item }>(`/api/v1/items/${outcome.item.id}`, { method: "PATCH", json: { kind: opts.defaultKind } })).item;
    if (!outcome.item.hasCover && tab.windowId !== undefined) void addScreenshot(outcome.item.id, tab.windowId);
    if (tab.id !== undefined) await markTab(tab.id, true);
  }
  return outcome;
}

// A link, an image or a URL: no page to read, the server fetches it.
export const pluckUrl = (url: string) => send({ url, source: "extension" });

export async function send(body: CreateItemBody): Promise<PluckOutcome> {
  try {
    const res = await api<PluckResponse>("/api/v1/items", { json: body });
    const first = res.results[0];
    return first ? { state: "plucked", item: first.item, created: first.created } : { state: "refused", message: res.rejected[0]?.message ?? "That did not work." };
  } catch (e) {
    if (e instanceof Unreachable) return { state: "queued", count: await enqueue(body) };
    if (e instanceof Refused) return { state: "refused", message: e.message };
    throw e;
  }
}

async function addScreenshot(itemId: string, windowId: number) {
  const shot = await screenshot(windowId);
  if (shot && shot.size <= 2_000_000) await api(`/api/v1/items/${itemId}/cover`, { method: "PUT", body: shot, contentType: "image/jpeg" }).catch(() => {});
}

// ---- The queue: plucks that could not reach the server wait here and are retried by an alarm -----------

const queue = createQueue({ read: () => get("queue"), write: (q) => set({ queue: q }) });

async function enqueue(body: CreateItemBody): Promise<number> {
  const count = await queue.add(body);
  await browser.alarms.create("drain", { periodInMinutes: 1 });
  await showQueued(count);
  return count;
}

export async function drain(): Promise<number> {
  const left = await queue.drain((body) => api("/api/v1/items", { json: body }));
  if (!left) await browser.alarms.clear("drain");
  await showQueued(left);
  return left;
}

// ---- The toolbar badge: a dot while plucks are queued, a tick on pages already in the library ----------

async function showQueued(count: number) {
  await browser.action.setBadgeBackgroundColor({ color: "#C27A3A" });
  await browser.action.setBadgeText({ text: count ? "•" : "" });
}

async function markTab(tabId: number, plucked: boolean) {
  if ((await get("queue")).length) return; // the queued dot wins
  await browser.action.setBadgeBackgroundColor({ tabId, color: "#7FD3AE" });
  await browser.action.setBadgeTextColor?.({ tabId, color: "#151A13" });
  await browser.action.setBadgeText({ tabId, text: plucked ? "✓" : "" });
}

export async function refreshBadge(tabId: number, url?: string) {
  if (!isWeb(url) || !(await get("tokens")) && !(await get("apiKey"))) return;
  const res = await api<{ item: Item | null }>(`/api/v1/items/lookup?url=${encodeURIComponent(url!)}`).catch(() => null);
  if (res) await markTab(tabId, Boolean(res.item));
}
