import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CookieBanner } from "@/components/CookieBanner";
import { fredoka, geist, geistMono, sourceSerif } from "./fonts";
import "./globals.css";

export const generateMetadata = async (): Promise<Metadata> => ({
  // Absolute URLs for OG images and canonical links: the app's public origin.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: "Pluck",
  description: (await getTranslations("site.meta"))("description"),
  icons: {
    icon: [{ url: "/favicon-32.svg", sizes: "32x32" }, { url: "/favicon-16.svg", sizes: "16x16" }],
    apple: [{ url: "/icon-180.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Pluck", statusBarStyle: "default" },
});

export const viewport: Viewport = {
  viewportFit: "cover", // the phone tab bar pads itself for the home indicator
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8F4" },
    { media: "(prefers-color-scheme: dark)", color: "#10130F" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={await getLocale()} className={`${geist.variable} ${geistMono.variable} ${fredoka.variable} ${sourceSerif.variable}`}>
      <body>
        <NextIntlClientProvider>
          <CookieBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
