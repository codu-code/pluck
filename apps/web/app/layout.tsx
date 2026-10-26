import { isLocale } from "@pluck/i18n";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { CookieBanner } from "@/components/CookieBanner";
import { LOCALE_HEADER } from "@/i18n/request";
import { localePath } from "@/lib/siteUrls";
import { fredoka, geist, geistMono, sourceSerif } from "./fonts";
import "./globals.css";

export const generateMetadata = async (): Promise<Metadata> => ({
  // Absolute URLs for OG images and canonical links: the app's public origin. A site page in another language goes
  // under its prefix, so its preview card (/de/connect/opengraph-image-…) is fetched in that language (proxy.ts).
  metadataBase: new URL((process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + localePath(urlLocale(await headers()), "/")),
  title: "Pluck",
  description: (await getTranslations("site.meta"))("description"),
  icons: {
    icon: [{ url: "/favicon-32.svg", sizes: "32x32" }, { url: "/favicon-16.svg", sizes: "16x16" }],
    apple: [{ url: "/icon-180.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Pluck", statusBarStyle: "default" },
  // Every page has a 1200 x 630 card (opengraph-image.tsx, lib/og.tsx); X shows it large too.
  twitter: { card: "summary_large_image" },
});

const urlLocale = (h: Headers) => {
  const l = h.get(LOCALE_HEADER);
  return isLocale(l) ? l : "en";
};

export const viewport: Viewport = {
  viewportFit: "cover", // the phone tab bar pads itself for the home indicator
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8F4" },
    { media: "(prefers-color-scheme: dark)", color: "#10130F" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The browser gets the site words and the two app pieces every page can show. The app's routes add the rest in
  // their own layouts, so a public page never carries the signed-in app's catalog.
  const { site, app } = await getMessages();
  const messages = { site, app: { cookies: app.cookies, error: app.error } };
  return (
    <html lang={await getLocale()} className={`${geist.variable} ${geistMono.variable} ${fredoka.variable} ${sourceSerif.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <CookieBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
