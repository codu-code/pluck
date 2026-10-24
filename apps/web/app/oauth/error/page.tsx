import type { Metadata } from "next";
import Link from "next/link";
import { BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export const metadata: Metadata = { title: "That did not work · Pluck", robots: { index: false } };

// Where Better Auth sends a failed authorisation request (an unknown client, a wrong redirect, an expired link).
export default async function OAuthError({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string }> }) {
  const { error, error_description } = await searchParams;
  return (
    <Standalone art={<BigMark />} title={<>That did not connect<Dot /></>} lede="Nothing changed in your Pluck. Most of the time, starting again fixes it.">
      <ol className={s.ruled}>
        <li><span className={s.n}>1</span><span>Start the connection again from your AI tool.</span></li>
        <li><span className={s.n}>2</span><span>Still failing? Remove Pluck there, then add it again with the link from <Link href="/connect" className={s.textLink}>Connect your AI</Link>.</span></li>
        <li><span className={s.n}>3</span><span>Stuck after that? <Link href="/support#ai" className={s.textLink}>Support</Link> has the rest.</span></li>
      </ol>
      {error && (
        <div className={s.field}>
          <span className={s.small}>What the server said, if your AI tool asks</span>
          <code className={s.code}>{error_description || error}</code>
        </div>
      )}
    </Standalone>
  );
}
