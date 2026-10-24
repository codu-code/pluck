import type { Metadata } from "next";
import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

export const metadata: Metadata = { title: "Pluck", robots: { index: false } };

// The title (its last full stop drawn in the accent) and the line under it, per action.
const said = (a: string | undefined, n: number): [string, string] => {
  switch (a) {
    case "keep": return ["Kept", "It stays where it is, and the days start again."];
    case "letgo": return ["Gone. Well, archived", "Nothing is deleted."]; // the title breaks after "Gone."
    case "undo-letgo": return ["Back where it was", ""];
    case "stop": return ["No more weekly emails", "Turn them back on in Settings whenever you like."];
    case "archive-all": return [`${n} item${n === 1 ? "" : "s"} moved to the Archive`, "Nothing is deleted."];
    default: return ["Done", ""];
  }
};

export default async function Done({ searchParams }: { searchParams: Promise<{ a?: string; undo?: string; count?: string }> }) {
  const { a, undo, count } = await searchParams;
  const [title, line] = said(a, Number(count ?? 0));
  return (
    <Standalone title={title.split(". ").map((part, i, all) => (i < all.length - 1 ? `${part}.` : <>{part}<Dot /></>))} lede={line || undefined} art={<BigMark />}>
      <p className={s.srOnly} role="status">{`${title}.${line ? ` ${line}` : ""}`}</p>
      <Actions>
        <Link href="/inbox" className={s.primary}>Open Pluck</Link>
        {undo && (
          <form method="post" action={`/api/d/${undo}`}>
            <button type="submit" className={s.secondary}>Undo</button>
          </form>
        )}
      </Actions>
    </Standalone>
  );
}
