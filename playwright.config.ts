import { defineConfig } from "@playwright/test";

const PORT = 3300;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0, // a retried pass is reported as flaky, so it still gets fixed
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    // Services first (Playwright starts this before globalSetup), the extension (local build), then the web production build.
    command: `pnpm stack && PLUCK_LOCAL=1 pnpm --filter @pluck/extension build && pnpm --filter @pluck/web build && pnpm --filter @pluck/web exec next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { BETTER_AUTH_URL: `http://127.0.0.1:${PORT}`, AUTH_RATE_LIMIT: "off", NEXT_PUBLIC_POSTHOG_KEY: "" }, // tests never report to PostHog
  },
});
