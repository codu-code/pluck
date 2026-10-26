import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { fileURLToPath } from "node:url";

// One .env at the repo root for every app. Absent on Vercel, where env comes from the project settings.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {}

// PostHog's ingest host (lib/analytics.ts, lib/telemetry.ts): EU unless a self-hoster points it elsewhere.
const posthog = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";

const config: NextConfig = {
  transpilePackages: ["@pluck/ui", "@pluck/shared-schemas", "@pluck/db", "@pluck/extract", "@pluck/blob", "@pluck/i18n"],
  // Parsers with large or native-ish dependency trees run from node_modules instead of the bundle.
  serverExternalPackages: ["defuddle", "linkedom", "unpdf", "@mozilla/readability", "undici"],
  // Monorepo root, so env and tracing resolve from there.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  // Blog posts (lib/blog.ts) are Markdown files imported as strings.
  turbopack: { rules: { "*.md": { type: "text" } } },
  poweredByHeader: false,
  skipTrailingSlashRedirect: true, // PostHog's ingest paths end in a slash
  // Dev: .env sets BETTER_AUTH_URL to 127.0.0.1, so the dev server must serve its scripts there too.
  allowedDevOrigins: ["127.0.0.1"],
  // Dev: sign-in cookies live on BETTER_AUTH_URL's host, so the other name for this machine (localhost for 127.0.0.1, or
  // the reverse) is sent there instead of signing in and landing signed out. Never in a build: redirects are fixed into
  // it, and a self-host image built with the placeholder URL would send a proxy's 127.0.0.1 traffic to localhost.
  async redirects() {
    if (process.env.NODE_ENV !== "development") return [];
    const origin = process.env.BETTER_AUTH_URL;
    const host = origin ? new URL(origin).hostname : "";
    const other = { "127.0.0.1": "localhost", localhost: "127.0.0.1" }[host];
    return other ? [{ source: "/:path*", has: [{ type: "host" as const, value: other }], destination: `${origin}/:path*`, permanent: false }] : [];
  },
  // Public lists live at /@handle/slug. A folder cannot start with "@" (that is a parallel-route slot), so the page is /p/.
  async rewrites() {
    return [
      { source: "/@:handle/:slug", destination: "/p/:handle/:slug" },
      // PostHog, first-party (lib/analytics.ts): blockers that drop third-party analytics would also drop error reports.
      { source: "/ingest/static/:path*", destination: `${posthog.replace(/^https:\/\/(\w+)\.i\./, "https://$1-assets.i.")}/static/:path*` },
      { source: "/ingest/:path*", destination: `${posthog}/:path*` },
    ];
  },
};

// Languages: i18n/request.ts picks one per request (packages/i18n holds the catalogs).
export default createNextIntlPlugin("./i18n/request.ts")(config);
