import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { currentUser } from "@/lib/auth";
import { publicListFor, readShared } from "@/lib/library";
import { CopyButton } from "./CopyButton";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("copy") };
}

const SHOWN = 4;

// "Pluck this list" lands here: sign in first if needed, then one button. No surprise writes on a GET.
export default async function CopyPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/copy/${listId}`)}`);
  const page = (await publicListFor(listId)) ?? (await readShared(user.id, listId).catch(() => null)); // public, or shared with them
  if (!page) notFound();
  const n = page.entries.length;
  const t = await getTranslations("app.copy");
  return (
    <Standalone
      title={<>{t("title")}<Dot /></>}
      lede={t.rich("lede", { count: n, name: page.list.name, b: (c) => <b>{c}</b> })}
      art={
        <div className={s.panel}>
          <div className={s.panelHead}><b>{page.list.name}</b><time>{t("items", { count: n })}</time></div>
          {page.entries.slice(0, SHOWN).map((e) => (
            <div key={e.id} className={s.entry}>
              <span className={s.ring} />
              <span className={s.entryText}><b>{e.title}</b><span>{e.note ?? e.siteName ?? (e.url ? new URL(e.url).hostname : t("note"))}</span></span>
            </div>
          ))}
          {n > SHOWN && <div className={s.more}>{t("more", { count: n - SHOWN })}</div>}
        </div>
      }
    >
      <CopyButton listId={listId} />
    </Standalone>
  );
}
