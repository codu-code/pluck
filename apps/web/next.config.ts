import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// One .env at the repo root for every app. Absent on Vercel, where env comes from the project settings.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {}

const config: NextConfig = {
  transpilePackages: ["@pluck/ui", "@pluck/shared-schemas", "@pluck/db"],
  // Monorepo root, so env and tracing resolve from there.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  poweredByHeader: false,
};

export default config;
