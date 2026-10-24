import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { currentUser } from "@/lib/auth";
import { publicListFor } from "@/lib/library";
import { CopyButton } from "./CopyButton";

export const metadata: Metadata = { title: "Pluck this list · Pluck" };

const SHOWN = 4;

// "Pluck this list" lands here: sign in first if needed, then one button. No surprise writes on a GET.
export default async function CopyPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/copy/${listId}`)}`);
  const page = await publicListFor(listId);
  if (!page) notFound();
  const n = page.entries.length;
  return (
    <Standalone
      title={<>Pluck this list<Dot /></>}
      lede={<>{n} item{n === 1 ? "" : "s"} land in your Inbox, and a private copy of <b>{page.list.name}</b> keeps their order and notes.</>}
      art={
        <div className={s.panel}>
          <div className={s.panelHead}><b>{page.list.name}</b><time>{n} item{n === 1 ? "" : "s"}</time></div>
          {page.entries.slice(0, SHOWN).map((e) => (
            <div key={e.id} className={s.entry}>
              <span className={s.ring} />
              <span className={s.entryText}><b>{e.title}</b><span>{e.note ?? e.siteName ?? (e.url ? new URL(e.url).hostname : "Note")}</span></span>
            </div>
          ))}
          {n > SHOWN && <div className={s.more}>and {n - SHOWN} more</div>}
        </div>
      }
    >
      <CopyButton listId={listId} />
    </Standalone>
  );
}
