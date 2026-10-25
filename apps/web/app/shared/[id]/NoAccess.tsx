"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Actions, Dot, Standalone, standaloneStyles as s } from "@/components/Standalone";
import { signOutHere } from "@/lib/sign-out";

// A shared link that does not open for this person: gone, taken back, or shared with another of their addresses.
export function NoAccess({ listId, email }: { listId: string; email: string }) {
  const router = useRouter();
  const t = useTranslations("app.shared.noAccess");
  return (
    <Standalone
      size="md"
      title={[t("title1"), <>{t("title2")}<Dot /></>]}
      lede={t.rich("lede", { email, b: (c) => <b>{c}</b> })}
    >
      <Actions>
        <Link href="/lists" className={s.primary}>{t("lists")}</Link>
        <button
          type="button"
          className={s.secondary}
          onClick={async () => {
            await signOutHere();
            router.push(`/signin?next=${encodeURIComponent(`/shared/${listId}`)}`);
          }}
        >
          {t("another")}
        </button>
      </Actions>
    </Standalone>
  );
}
