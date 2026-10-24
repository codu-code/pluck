import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fredoka, geist, sourceSerif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pluck",
  description: "Pluck it. A fast, open-source URL saver your AI can read.",
  icons: { icon: [{ url: "/favicon-32.svg", sizes: "32x32" }, { url: "/favicon-16.svg", sizes: "16x16" }] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${fredoka.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
