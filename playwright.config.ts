import { defineConfig } from "@playwright/test";

const PORT = 3300;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    // Services first (Playwright starts this before globalSetup), then the production build, not the dev server.
    command: `pnpm stack && pnpm --filter @pluck/web build && pnpm --filter @pluck/web exec next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
