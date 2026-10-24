import { captureServerError } from "./telemetry";

// Structured JSON logs. Never log bearer tokens or page content. Errors also go to error tracking (lib/telemetry.ts),
// without the user id: pass the caught error itself as `error` so its stack goes too.
type Fields = { userId?: string; itemId?: string; jobId?: string; durationMs?: number; error?: unknown; [k: string]: unknown };

export function log(level: "info" | "warn" | "error", msg: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields, ...(fields.error === undefined ? {} : { error: String(fields.error) }) });
  (level === "error" ? console.error : console.log)(line);
  if (level === "error") {
    const { userId: _who, error, ...where } = fields;
    captureServerError(error ?? new Error(msg), { msg, ...where });
  }
}
