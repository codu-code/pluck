import { formatLocale, isLocale, matchLocale, messagesFor, parseAcceptLanguage, type Locale } from "@pluck/i18n";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

// The language someone picked (Settings, or the site footer) lives in this cookie; Settings also keeps it on the
// account, which is what emails go by.
export const LOCALE_COOKIE = "pluck_locale";
// A site page's language, from its URL (/de/connect): proxy.ts sets it, and it wins over the cookie.
export const LOCALE_HEADER = "x-pluck-locale";

// From any request's headers: the picked language, else the browser's. Used by pages and by auth (emails, sign-up).
export function localeFrom(h: Headers | null | undefined): Locale {
  const picked = h?.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))?.[1];
  return isLocale(picked) ? picked : matchLocale(parseAcceptLanguage(h?.get("accept-language")));
}

export async function requestLocale(): Promise<Locale> {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  const picked = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(picked) ? picked : matchLocale(parseAcceptLanguage((await headers()).get("accept-language")));
}

export default getRequestConfig(async () => {
  const locale = await requestLocale();
  return { locale: formatLocale(locale), messages: { site: messagesFor("site", locale), app: messagesFor("app", locale) } };
});
