import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Actions, BigMark, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";

// A public List link that does not open: made private, deleted, or a typo. Still a 404.
export default async function ListNotFound() {
  const t = await getTranslations("site.publicList.notFound");
  return (
    <Standalone
      size="md"
      // One message for the whole sentence; <line> marks where Standalone would break it.
      title={<>{t.rich("title", { line: (c) => <span className={s.titleLine}>{c} </span>, dot: () => <Dot /> })}</>}
      lede={t("lede")}
      art={<BigMark />}
    >
      <Actions>
        <Link href="/" className={s.primary}>{t("what")}</Link>
        <Link href="/lists" className={s.textLink}>{t("lists")}</Link>
      </Actions>
    </Standalone>
  );
}
