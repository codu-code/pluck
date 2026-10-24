import type { CreateItemBody } from "@pluck/shared-schemas";

// Everything the extension keeps lives in storage.local: the service worker can be killed at any time,
// so nothing is held in memory between events.
export type Tokens = { access: string; refresh: string | null; expiresAt: number };
export type Settings = {
  server: string;
  defaultKind: "guess" | "link" | "video";
  sendContent: boolean;
  transcripts: boolean;
};
export type Queued = { body: CreateItemBody; at: number };

type Local = {
  settings: Settings;
  clientIds: Record<string, string>; // server origin → client_id this extension registered there
  tokens: Tokens | null;
  apiKey: string | null; // self-hosters can paste a pk_live_ key instead of signing in
  email: string | null;
  queue: Queued[];
  lastListId: string | null;
  seenTips: boolean;
};

const DEFAULTS: Local = {
  settings: { server: __DEFAULT_SERVER__, defaultKind: "guess", sendContent: true, transcripts: true },
  clientIds: {},
  tokens: null,
  apiKey: null,
  email: null,
  queue: [],
  lastListId: null,
  seenTips: false,
};

export async function get<K extends keyof Local>(key: K): Promise<Local[K]> {
  const got = await browser.storage.local.get(key);
  return (got[key] as Local[K] | undefined) ?? DEFAULTS[key];
}

export const set = (patch: Partial<Local>) => browser.storage.local.set(patch);

export async function settings(): Promise<Settings> {
  return { ...DEFAULTS.settings, ...(await get("settings")) };
}
