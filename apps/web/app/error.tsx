"use client";

import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

// Anything a page throws lands here instead of the framework's bare error screen.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Standalone art={<BigMark />} title={<>That broke<Dot /></>} lede="Our side, not yours. Nothing you plucked is lost. Try again, and if it keeps happening, tell us.">
      <Actions>
        <button type="button" className={s.primary} onClick={reset}>Try again</button>
        <Link href="/support#bugs" className={s.textLink}>Report it</Link>
      </Actions>
    </Standalone>
  );
}
