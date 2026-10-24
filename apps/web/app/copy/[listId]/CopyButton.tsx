"use client";

import type { List } from "@pluck/shared-schemas";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CopyButton({ listId }: { listId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={state === "busy"}
        style={{ height: 48, padding: "0 20px", borderRadius: 10, border: 0, background: "var(--brand)", color: "var(--on-brand)", font: "inherit", fontWeight: 600, cursor: "pointer" }}
        onClick={async () => {
          setState("busy");
          const res = await fetch("/api/v1/lists/copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listId }) });
          const body = await res.json();
          if (res.ok) return router.push(`/lists/${(body as { list: List }).list.id}`);
          setMessage(body?.error?.message ?? "That did not go through.");
          setState("error");
        }}
      >
        {state === "busy" ? "Plucking" : "Pluck this list"}
      </button>
      {state === "error" && <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>{message}</p>}
    </>
  );
}
