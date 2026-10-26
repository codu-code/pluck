import { defineConfig } from "vitest/config";

export default defineConfig({
  // The web app's "@/" path, so its route handlers can be tested as they are.
  resolve: { alias: [{ find: /^@\//, replacement: new URL("./apps/web/", import.meta.url).pathname }] },
  test: {
    include: ["{apps,packages,infra,scripts}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/cdk.out/**"],
    globalSetup: ["./vitest.global-setup.ts"],

    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 20_000,
  },
});
