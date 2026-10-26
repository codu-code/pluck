import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_HEADER, localeFrom } from "@/i18n/request";
import { CHROME_STORE_URL, cardPage, isSitePath, localePath, splitLocale } from "@/lib/siteUrls";

// The marketing site's language URLs (lib/siteUrls.ts). /de/connect is served by the /connect page in German.
// An English URL sends someone who picked another language, or whose browser asks for one, to that language's URL;
// a crawler sends neither, so it gets English and finds the others through hreflang and the sitemap.
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/en" || pathname.startsWith("/en/")) return NextResponse.redirect(new URL((pathname.slice(3) || "/") + search, req.url), 308);
  const { locale, path } = splitLocale(pathname);
  if (path === "/chrome") return NextResponse.redirect(CHROME_STORE_URL, 308); // the coming-soon page, before the listing
  const headers = new Headers(req.headers);
  headers.delete(LOCALE_HEADER); // only a site URL says which language it is
  const card = cardPage(path);
  if (card !== undefined && isSitePath(card || "/")) {
    // A page's preview card, fetched by a crawler: in the language of its URL, never redirected.
    headers.set(LOCALE_HEADER, locale ?? "en");
    return locale ? NextResponse.rewrite(new URL(path + search, req.url), { request: { headers } }) : NextResponse.next({ request: { headers } });
  }
  if (!isSitePath(path)) return NextResponse.next({ request: { headers } });

  const wanted = locale ?? localeFrom(req.headers);
  if (!locale && wanted !== "en") return NextResponse.redirect(new URL(localePath(wanted, path) + search, req.url));
  headers.set(LOCALE_HEADER, wanted);
  if (!locale) return NextResponse.next({ request: { headers } });
  const res = NextResponse.rewrite(new URL(path + search, req.url), { request: { headers } });
  // Reading a page in a language makes it yours, so sign-in and the app that follow are in it too.
  if (req.cookies.get(LOCALE_COOKIE)?.value !== locale) res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/((?!api|_next|.*\\.).*)"] };
