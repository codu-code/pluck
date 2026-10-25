import type { Metadata } from "next";
import Link from "next/link";
import { Actions, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { linkParams } from "@/lib/signin-link";

export const metadata: Metadata = { title: "Sign in · Pluck", robots: { index: false }, referrer: "no-referrer" };

// Where the email's link lands. Opening it does nothing; the button does (see lib/signin-link.ts). No auto-submit:
// some scanners run scripts, and one tap is a small price for a link that works in any company's mail.
export default async function SignInLink({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = linkParams(await searchParams);
  if (!p.token)
    return (
      <Standalone title={<>This link is not complete<Dot /></>} lede="Part of it may have been cut off on the way. Send yourself a new one.">
        <Actions><Link href="/signin" className={s.primary}>Send a new link</Link></Actions>
      </Standalone>
    );
  return (
    <Standalone title={["One tap", <>and you are in<Dot /></>]} lede="This link works once, for 10 minutes from when we sent it.">
      <Actions>
        <form method="post" action="/signin/link/go">
          {Object.entries(p).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <button type="submit" className={s.primary}>Sign in to Pluck</button>
        </form>
      </Actions>
    </Standalone>
  );
}
