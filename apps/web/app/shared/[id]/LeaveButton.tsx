"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

// Takes a shared List off your Lists. Its owner can share it again.
export function LeaveButton({ listId, className }: { listId: string; className?: string }) {
  const router = useRouter();
  const t = useTranslations("app.shared");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const res = await fetch(`/api/v1/shared/${listId}`, { method: "DELETE" });
        if (res.ok) router.push("/lists");
      }}
    >
      {t("leave")}
    </button>
  );
}
