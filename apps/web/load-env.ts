import { fileURLToPath } from "node:url";

// One .env at the repo root, read before anything else is imported: modules like lib/origin.ts read env as they load.
// Absent in Docker and on Vercel, where env comes from the environment.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {}
