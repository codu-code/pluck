// Structured JSON logs. Never log bearer tokens or page content.
type Fields = { userId?: string; itemId?: string; jobId?: string; durationMs?: number; [k: string]: unknown };

export function log(level: "info" | "warn" | "error", msg: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  (level === "error" ? console.error : console.log)(line);
}
