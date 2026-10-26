import { DEFAULT_LOCALE, LOCALES, type Locale } from "@pluck/i18n";

// The marketing site has one URL per language so search engines can list each: English at the root, the others
// under a prefix (/de/connect, /pt-br/blog/pocket-is-gone). proxy.ts reads the prefix; the signed-in app keeps one
// URL and goes by the cookie (i18n/request.ts).
export const SITE_PAGES = ["/", "/connect", "/open-source", "/iphone", "/chrome", "/support", "/privacy", "/terms", "/blog"];
export const isSitePath = (path: string) => SITE_PAGES.includes(path) || /^\/blog\/[a-z0-9-]+$/.test(path);
const prefix = (l: Locale) => l.toLowerCase();

// "/de/connect" → { locale: "de", path: "/connect" }. An unprefixed path has no locale (it's the English URL).
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split("/");
  const locale = LOCALES.find((l) => l !== DEFAULT_LOCALE && prefix(l) === first);
  return locale ? { locale, path: `/${rest.join("/")}` } : { locale: null, path: pathname };
}

// A site page's URL in a language; anything else (/signin, /inbox, another site) comes back as it was.
export function localePath(locale: Locale, href: string): string {
  const at = href.search(/[?#]/);
  const [path, rest] = at < 0 ? [href, ""] : [href.slice(0, at), href.slice(at)];
  if (locale === DEFAULT_LOCALE || !isSitePath(path)) return href;
  return `/${prefix(locale)}${path === "/" ? "" : path}${rest}`;
}

// Canonical and hreflang links for a site page: itself in this language, and every language's version of it.
export const siteAlternates = (locale: Locale, path: string, origin = "") => ({
  canonical: origin + localePath(locale, path),
  languages: { ...Object.fromEntries(LOCALES.map((l) => [l, origin + localePath(l, path)])), "x-default": origin + path },
});

// A site page's link-preview card (its opengraph-image route, /connect/opengraph-image-<hash>), as the page it's for.
export const cardPage = (path: string) => path.match(/^(.*)\/opengraph-image[^/]*$/)?.[1];
