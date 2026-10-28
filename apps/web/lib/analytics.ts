import posthog, { type CaptureResult } from "posthog-js";

// Product analytics and error tracking in the browser (PostHog, EU). Off entirely when NEXT_PUBLIC_POSTHOG_KEY is
// unset, which is every self-hosted copy unless its owner sets one.
//
// Errors are sent from the first page, from memory: no cookie, no storage, no person. How Pluck gets used (pages,
// clicks, the account) is sent only after "Pluck it, I'm in", and never what anyone plucked: element text and
// attributes are masked, and page titles, query strings and hashes are dropped before anything leaves the browser.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
export const analyticsOn = Boolean(KEY);

export type Consent = "yes" | "no";
const STORE = "pluck:consent";
const YEAR = 365 * 24 * 60 * 60 * 1000; // asked again after a year
export const CONSENT_EVENT = "pluck:consent"; // fired on window when the answer changes
export const OPEN_COOKIES_EVENT = "pluck:cookies"; // fired by the "Cookies" links to ask again

let consent: Consent | null = null;
let started = false;

export function readConsent(): Consent | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as { answer: Consent; at: number } | null;
    return saved && Date.now() - saved.at < YEAR ? saved.answer : null;
  } catch {
    return null; // storage blocked: ask, and keep nothing
  }
}

export function startAnalytics(): void {
  if (!KEY || started) return;
  started = true;
  consent = readConsent();
  posthog.init(KEY, {
    api_host: "/ingest", // proxied by next.config.ts, so it is first-party
    ui_host: "https://eu.posthog.com",
    defaults: "2026-08-30",
    persistence: consent === "yes" ? "localStorage+cookie" : "memory",
    person_profiles: "identified_only",
    capture_exceptions: true,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true, // no feature flags, so no flags call carrying an id before anyone said yes
    mask_all_text: true,
    mask_all_element_attributes: true,
    before_send: (event) => scrub(event, consent),
  });
}

export function setConsent(answer: Consent): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ answer, at: Date.now() }));
  } catch {
    // storage blocked: the answer holds for this page only
  }
  const was = consent;
  consent = answer;
  if (started) {
    if (answer === "yes" && was !== "yes") {
      posthog.set_config({ persistence: "localStorage+cookie" });
      posthog.capture("$pageview");
    }
    if (answer === "no" && was === "yes") {
      posthog.reset(); // forgets the id and clears its cookie and storage
      posthog.set_config({ persistence: "memory" });
    }
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function identify(userId: string): void {
  startAnalytics();
  if (started && consent === "yes") posthog.identify(userId);
}

export function forgetUser(): void {
  if (started) posthog.reset();
}

const keepUtm = (url: string) => {
  try {
    const u = new URL(url);
    const utm = [...u.searchParams].filter(([k]) => k.startsWith("utm_"));
    u.search = new URLSearchParams(utm).toString();
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
};

// Runs on every event before it is sent.
export function scrub(event: CaptureResult | null, given: Consent | null): CaptureResult | null {
  if (!event) return null;
  if (given !== "yes" && event.event !== "$exception") return null;
  const p = event.properties;
  // A script from another origin (an in-app browser's, an extension's) fails with no message and no stack: nothing to fix.
  if (event.event === "$exception" && /^Script error\.?$/.test(p.$exception_list?.[0]?.value ?? "")) return null;
  delete p.title; // item pages are titled with the item
  delete p.$title;
  for (const k of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"]) if (typeof p[k] === "string") p[k] = keepUtm(p[k]);
  if (event.$set_once) for (const k of ["$initial_current_url", "$initial_referrer"]) if (typeof event.$set_once[k] === "string") event.$set_once[k] = keepUtm(event.$set_once[k]);
  return event;
}
