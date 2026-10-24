import PostHog from "posthog-react-native";
import { kv } from "./kv";

// Usage and crash reports (PostHog, EU), when the build has EXPO_PUBLIC_POSTHOG_KEY. Store builds set it; local and
// self-hosted builds without it send nothing.
//
// Crashes and errors are sent either way, under a random id that is never tied to the account. Screens and the
// account are sent only after "Pluck it, I'm in", the same question the website asks, asked once.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export type Consent = "yes" | "no";

let consent: Consent | null = null;
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

export async function loadConsent(): Promise<Consent | null> {
  consent = await kv.get<Consent | null>("consent", null);
  listeners.forEach((fn) => fn(consent));
  return consent;
}

export async function setConsent(answer: Consent): Promise<void> {
  const was = consent;
  consent = answer;
  await kv.set("consent", answer);
  if (answer === "no" && was === "yes") posthog?.reset(); // a fresh random id, not tied to the account
  listeners.forEach((fn) => fn(answer));
}

export const onConsent = (fn: (c: Consent | null) => void) => (listeners.add(fn), () => void listeners.delete(fn));
export const currentConsent = () => consent;

export function identify(userId: string): void {
  if (consent === "yes") posthog?.identify(userId);
}

export function screen(path: string): void {
  posthog?.screen(path); // the route, never its query: item and list ids, not their content
}

export function forgetUser(): void {
  posthog?.reset();
}
