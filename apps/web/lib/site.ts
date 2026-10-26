import { fromIntlLocale } from "@pluck/i18n";
import { getLocale } from "next-intl/server";
import { MCP_RESOURCE } from "./auth";
import { siteAlternates } from "./siteUrls";

// Links the marketing site needs that only exist at launch. Placeholders stay [LIKE THIS] until then.
export const REPO_URL = "https://github.com/codu-code/pluck";
export const CLONE_URL = "https://github.com/codu-code/pluck";
// shortcut: a "coming soon" page while the listing is in review; swap in the store URL once it is live.
export const CHROME_STORE_URL = "/chrome";
// shortcut: the TestFlight beta page while the app is in public beta; swap in the App Store URL once it is live.
export const APP_STORE_URL = "/iphone";
// The public beta: anyone with the link can join (up to the limit set in App Store Connect, TestFlight, Public beta).
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/9JbctwC4";
export const TESTFLIGHT_APP_URL = "https://apps.apple.com/app/testflight/id899247664";
export const LICENCE = "AGPL-3.0 (server) and MIT (apps)";
export const CONNECTOR_URL = MCP_RESOURCE;

const ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// A site page's canonical and hreflang links, absolute (the root layout's metadataBase carries the language's prefix,
// for the preview card), for the language it's shown in.
export async function pageMeta(path: string) {
  return { alternates: siteAlternates(fromIntlLocale(await getLocale()), path, ORIGIN) };
}
