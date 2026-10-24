import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fredoka, geist, geistMono, sourceSerif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute URLs for OG images and canonical links: the app's public origin.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: "Pluck",
  description: "Pluck it. A fast, open-source URL saver your AI can read.",
  icons: {
    icon: [{ url: "/favicon-32.svg", sizes: "32x32" }, { url: "/favicon-16.svg", sizes: "16x16" }],
    apple: [{ url: "/icon-180.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Pluck", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8F4" },
    { media: "(prefers-color-scheme: dark)", color: "#10130F" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${fredoka.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
