import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fredoka, geist, sourceSerif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
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
    <html lang="en" className={`${geist.variable} ${fredoka.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
