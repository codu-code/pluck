import { ANSWER_LASTS_MS, type ConsentAnswer } from "@pluck/shared-schemas";
import PostHog from "posthog-react-native";
import { kv } from "./kv";

// Usage and crash reports (PostHog, EU), when the build has EXPO_PUBLIC_POSTHOG_KEY. Store builds set it; local and
// self-hosted builds without it send nothing.
//
// Crashes and errors are sent either way, under a random id that is never tied to the account. Screens and the
// account are sent only after "Pluck it, I'm in", the same question the website asks, asked again after a year.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export type Consent = "yes" | "no";

let consent: Consent | null = null;
let answered: ConsentAnswer | null = null;
const listeners = new Set<(c: Consent | null) => void>();

export const posthog = KEY
  ? new PostHog(KEY, {
      host: "https://eu.i.posthog.com",
      captureAppLifecycleEvents: true,
      errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true } },
      before_send: (event) => (event && (consent === "yes" || event.event === "$exception") ? event : null),
    })
  : null;

export const analyticsOn = posthog !== null;

// This phone's answer and when it was given.
export async function loadConsent(): Promise<ConsentAnswer | null> {
  const saved = await kv.get<ConsentAnswer | null>("answer", null);
  answered = saved && Date.now() - saved.at < ANSWER_LASTS_MS ? saved : null;
  consent = answered?.answer ?? null;
  listeners.forEach((fn) => fn(consent));
  return answered;
}

// at: when it was given, here or (taking the account's) on another device.
export async function setConsent(answer: Consent, at = Date.now()): Promise<void> {
  const was = consent;
  consent = answer;
  answered = { answer, at };
  await kv.set("answer", answered);
  if (answer === "no" && was === "yes") posthog?.reset(); // a fresh random id, not tied to the account
  listeners.forEach((fn) => fn(answer));
}

export const onConsent = (fn: (c: Consent | null) => void) => (listeners.add(fn), () => void listeners.delete(fn));
export const currentConsent = () => consent;
export const currentAnswer = () => answered;

export function identify(userId: string): void {
  if (consent === "yes") posthog?.identify(userId);
}

export function screen(path: string): void {
  posthog?.screen(path); // the route, never its query: item and list ids, not their content
}

export function forgetUser(): void {
  posthog?.reset();
}
