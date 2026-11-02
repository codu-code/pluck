"use client";

import { useEffect } from "react";
import { CONSENT_EVENT, identify, readConsent, setConsent, type Consent } from "@/lib/analytics";

const save = (analytics: Consent) =>
  fetch("/api/v1/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { analytics } }) }).catch(() => null);

// One answer for the whole account (settings.analytics), so the server knows it too: a browser that has none takes the
// account's, an account that has none takes the browser's, and a new answer here becomes the account's.
// Ties usage to the account only once they said yes (lib/analytics.ts decides).
export function AnalyticsUser({ id, answer }: { id: string; answer: Consent | null }) {
  useEffect(() => {
    let account = answer;
    const local = readConsent();
    if (account && account !== local) setConsent(account);
    else if (!account && local) void save((account = local));
    const sync = () => {
      identify(id);
      const now = readConsent();
      if (now && now !== account) void save((account = now));
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [id, answer]);
  return null;
}
