"use client";

import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { fredoka, geist, geistMono } from "./fonts";
import "./globals.css";

// When the root layout itself fails, this replaces it, so it brings its own html, fonts and styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${fredoka.variable}`}>
      <body>
        <Standalone art={<BigMark />} title={<>That broke<Dot /></>} lede="Our side, not yours. Nothing you plucked is lost. Try again in a moment.">
          <Actions>
            <button type="button" className={s.primary} onClick={reset}>Try again</button>
          </Actions>
        </Standalone>
      </body>
    </html>
  );
}
