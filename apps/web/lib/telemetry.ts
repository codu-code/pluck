import { after } from "next/server";
import { PostHog } from "posthog-node";

// Server errors to PostHog's error tracking, when NEXT_PUBLIC_POSTHOG_KEY is set. No person: every server error is
// filed under "server", with the message and where it happened, never who it happened to.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let client: PostHog | null = null;

export function captureServerError(error: unknown, properties: Record<string, unknown>): void {
  if (!KEY) return;
  client ??= new PostHog(KEY, { host: process.env.POSTHOG_HOST || "https://eu.i.posthog.com", flushAt: 1, flushInterval: 0 });
  const sending = client.captureExceptionImmediate(error, "server", { ...properties, $process_person_profile: false }).catch(() => {});
  try {
    after(() => sending); // keep a serverless function alive until it is sent
  } catch {
    // outside a request (the Docker worker loop): the promise finishes on its own
  }
}
