"use client";

import { useState } from "react";
import { Actions, standaloneStyles as s } from "@/components/Standalone";

// The signed query from this page's URL goes back with the decision, as the OAuth provider expects.
export function ConsentButtons() {
  const [busy, setBusy] = useState(false);
  async function decide(accept: boolean) {
    setBusy(true);
    const res = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
    });
    const body = (await res.json().catch(() => null)) as { url?: string } | null;
    if (body?.url) window.location.href = body.url;
    else setBusy(false);
  }
  return (
    <Actions>
      <button type="button" className={s.primary} disabled={busy} onClick={() => decide(true)}>Allow</button>
      <button type="button" className={s.secondary} disabled={busy} onClick={() => decide(false)}>Deny</button>
    </Actions>
  );
}
