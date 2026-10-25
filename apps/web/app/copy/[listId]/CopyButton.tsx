"use client";

import type { List } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions, standaloneStyles as s } from "@/components/Standalone";

export function CopyButton({ listId }: { listId: string }) {
  const router = useRouter();
  const t = useTranslations("app.copy");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");
  async function copy() {
    setState("busy");
    const res = await fetch("/api/v1/lists/copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listId }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { list?: List; error?: { message?: string } } | null;
    if (res?.ok && body?.list) return router.push(`/lists/${body.list.id}`);
    setMessage(body?.error?.message ?? t("failed"));
    setState("error");
  }
  return (
    <>
      <Actions>
        <button type="button" className={s.primary} disabled={state === "busy"} onClick={() => void copy()}>
          {state === "busy" ? t("busy") : t("action")}
        </button>
      </Actions>
      {state === "error" && <p role="alert" className={s.error}>{message}</p>}
    </>
  );
}
