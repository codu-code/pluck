import { fromIntlLocale } from "@pluck/i18n";
import { getLocale } from "next-intl/server";
import { MCP_RESOURCE } from "./auth";
import { siteAlternates } from "./siteUrls";
import { ORIGIN } from "./origin";

// Where the marketing site sends people.
export const REPO_URL = "https://github.com/codu-code/pluck";
// shortcut: the TestFlight beta page while the app is in public beta; swap in the App Store URL once it is live.
export const APP_STORE_URL = "/iphone";
// The public beta: anyone with the link can join (up to the limit set in App Store Connect, TestFlight, Public beta).
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/9JbctwC4";
export const TESTFLIGHT_APP_URL = "https://apps.apple.com/app/testflight/id899247664";
export const LICENCE = "Apache-2.0";
export const CONNECTOR_URL = MCP_RESOURCE;


// A site page's canonical and hreflang links, absolute (the root layout's metadataBase carries the language's prefix,
// for the preview card), for the language it's shown in.
export async function pageMeta(path: string) {
  return { alternates: siteAlternates(fromIntlLocale(await getLocale()), path, ORIGIN) };
}
