import { analyticsOf } from "@pluck/db";
import { Source } from "@pluck/shared-schemas";
import { after } from "next/server";
import { PostHog, type EventMessage } from "posthog-node";

// Errors and usage to PostHog, when NEXT_PUBLIC_POSTHOG_KEY is set. Self-hosted copies without it send nothing.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let client: PostHog | null = null;
const posthog = () => (client ??= new PostHog(KEY!, { host: process.env.POSTHOG_HOST || "https://eu.i.posthog.com", flushAt: 1, flushInterval: 0 }));

function keepAlive(sending: Promise<unknown>): void {
  try {
    after(() => sending); // keep a serverless function alive until it is sent
  } catch {
    // outside a request (the Docker worker loop): the promise finishes on its own
  }
}

// No person: every server error is filed under "server", with the message and where it happened, never who it happened to.
export function captureServerError(error: unknown, properties: Record<string, unknown>): void {
  if (!KEY) return;
  keepAlive(posthog().captureExceptionImmediate(error, "server", { ...properties, $process_person_profile: false }).catch(() => {}));
}

// ---- Usage -------------------------------------------------------------------------------------------
// Sent only for an account whose answer to the cookie question is yes (settings.analytics), under its id.
// Each event may carry only the properties listed here: enums, counts and timings, never what anyone plucked.
// docs/analytics.md says the same, and telemetry.test.ts holds the two together.
export const EVENTS = {
  signed_up: ["via"],
  plucked: ["source", "kind", "re_pluck", "count"],
  ai_tool_connected: ["client_name"],
  ai_tool_disconnected: ["client_name"],
  mcp_tool_called: ["tool", "client_name", "ok", "error_code", "result_count", "duration_ms"],
  mcp_prompt_used: ["prompt", "client_name"],
  list_created: ["by"],
  list_made_public: [],
  list_shared: ["people_count"],
  import_finished: ["import_source", "total", "failed"],
  highlight_made: [],
  item_opened: ["kind", "preview"],
  searched: ["result_count"],
  api_key_created: [],
  email_in_used: [],
  handle_picked: [],
  export_requested: [],
  $set: [], // person properties only
} as const satisfies Record<string, readonly string[]>;

export const PERSON = [
  "via", "signed_up_at", "heard_from", "items_bucket", "ai_tools", "has_public_list", "digest_on", "locale",
  ...Source.options.map((s) => `plucked_from_${s}` as const),
] as const;

export type UsageEvent = keyof typeof EVENTS;
type Value = string | number | boolean | string[] | null;
type Lazy<T> = T | (() => Promise<T>);
export type Props<E extends UsageEvent> = Partial<Record<(typeof EVENTS)[E][number], Value>>;
export type Person = Partial<Record<(typeof PERSON)[number], Value>>;
type Options = { person?: Lazy<Person>; once?: Person; at?: Date; uuid?: string };

const pick = (o: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(Object.entries(o).filter(([k, v]) => keys.includes(k) && v !== undefined));

// The message as it leaves: anything not on the lists above is dropped here, whatever a caller passed.
export function usageMessage(userId: string, event: UsageEvent, props: Record<string, unknown>, { person = {}, once = {}, at, uuid }: { person?: Record<string, unknown>; once?: Record<string, unknown>; at?: Date; uuid?: string } = {}): EventMessage {
  const $set = pick(person, PERSON);
  const $set_once = pick(once, PERSON);
  return {
    distinctId: userId, event, timestamp: at, uuid,
    properties: { ...pick(props, EVENTS[event]), ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($set_once).length ? { $set_once } : {}) },
  };
}

const resolve = async <T,>(x: Lazy<T>): Promise<T> => (typeof x === "function" ? (x as () => Promise<T>)() : x);

// Props and person properties can be lazy, so their lookups run only for an account that said yes.
export function track<E extends UsageEvent>(userId: string, event: E, props: Lazy<Props<E>> = {}, opts: Options = {}): void {
  if (!KEY) return;
  keepAlive(
    (async () => {
      if ((await analyticsOf(userId))?.consent !== "yes") return;
      const message = usageMessage(userId, event, await resolve(props), { ...opts, person: await resolve(opts.person ?? {}) });
      await posthog().captureImmediate(message);
    })().catch(() => {}),
  );
}

// signed_up is sent when the account first says yes, dated when it began. Its uuid is fixed by the account, so
// PostHog keeps one however often the answer flips back to yes.
export async function trackSignUp(userId: string): Promise<void> {
  const a = await analyticsOf(userId);
  if (!a) return;
  const hex = `${userId}00000000`;
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  track(userId, "signed_up", { via: a.via ?? "direct" }, { once: { via: a.via ?? "direct", signed_up_at: a.createdAt.toISOString() }, at: a.createdAt, uuid });
}

// Sent for everyone, like errors: something broke, with nobody named (no person, the same "server" id as errors).
export const ANONYMOUS = { extract_failed: ["kind", "preview", "reason"] } as const satisfies Record<string, readonly string[]>;

export function trackAnonymous<E extends keyof typeof ANONYMOUS>(event: E, props: Partial<Record<(typeof ANONYMOUS)[E][number], Value>>): void {
  if (!KEY) return;
  keepAlive(posthog().captureImmediate({ distinctId: "server", event, properties: { ...pick(props, ANONYMOUS[event]), $process_person_profile: false } }).catch(() => {}));
}

export const itemsBucket = (n: number) => (n === 0 ? "0" : n < 10 ? "1-9" : n < 100 ? "10-99" : "100+");
