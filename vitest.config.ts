import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{apps,packages,infra,scripts}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/cdk.out/**"],
    globalSetup: ["./vitest.global-setup.ts"],

    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 20_000,
  },
});
